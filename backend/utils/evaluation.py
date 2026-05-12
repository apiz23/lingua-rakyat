"""
utils/evaluation.py — Model Performance & Validation Metrics
=============================================================
Implements quantitative evaluation for the RAG pipeline, addressing
the critical gap identified in the hackathon evaluation report (1.6/10).

Metrics implemented:
  - ROUGE-1 / ROUGE-2 / ROUGE-L  (summarization quality)
  - BLEU score                    (translation/generation quality)
  - Exact Match (EM)              (retrieval precision)
  - Answer Relevancy Score        (confidence-weighted)
  - Readability score             (Flesch-Kincaid grade level proxy)
  - Latency tracking              (p50 / p95 / p99)
  - Multilingual accuracy         (per-language breakdown)

Usage:
    from utils.evaluation import Evaluator
    ev = Evaluator()
    ev.record(question, answer, ground_truth, language, confidence, latency_ms)
    report = ev.report()
"""

import re
import math
import json
import logging
from collections import defaultdict, Counter
from datetime import datetime
from typing import Callable, Optional

logger = logging.getLogger("evaluation")

# ─── Text Normalization ───────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split into tokens."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return text.split()


def _ngrams(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i:i+n]) for i in range(len(tokens) - n + 1))


# ─── ROUGE ───────────────────────────────────────────────────────────────────

def rouge_n(hypothesis: str, reference: str, n: int) -> dict:
    """
    Compute ROUGE-N between a hypothesis and a reference string.

    Returns:
        {"precision": float, "recall": float, "f1": float}
    """
    hyp_tokens = _tokenize(hypothesis)
    ref_tokens = _tokenize(reference)

    hyp_ng = _ngrams(hyp_tokens, n)
    ref_ng = _ngrams(ref_tokens, n)

    if not ref_ng:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    overlap = sum((hyp_ng & ref_ng).values())
    precision = overlap / max(sum(hyp_ng.values()), 1)
    recall    = overlap / max(sum(ref_ng.values()), 1)
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall":    round(recall,    4),
        "f1":        round(f1,        4),
    }


def rouge_l(hypothesis: str, reference: str) -> dict:
    """
    Compute ROUGE-L (Longest Common Subsequence) between hypothesis and reference.
    """
    hyp = _tokenize(hypothesis)
    ref = _tokenize(reference)

    # LCS via DP
    m, n = len(hyp), len(ref)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if hyp[i-1] == ref[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    lcs_len = dp[m][n]

    precision = lcs_len / max(m, 1)
    recall    = lcs_len / max(n, 1)
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall":    round(recall,    4),
        "f1":        round(f1,        4),
    }


# ─── BLEU ─────────────────────────────────────────────────────────────────────

def bleu_score(hypothesis: str, reference: str, max_n: int = 4) -> float:
    """
    Compute corpus-level BLEU score (1 to max_n gram average).

    Returns:
        float in [0, 1]
    """
    hyp_tokens = _tokenize(hypothesis)
    ref_tokens = _tokenize(reference)

    if not hyp_tokens:
        return 0.0

    # Brevity penalty
    bp = min(1.0, math.exp(1 - len(ref_tokens) / max(len(hyp_tokens), 1)))

    log_avg = 0.0
    valid_n = 0
    for n in range(1, max_n + 1):
        hyp_ng = _ngrams(hyp_tokens, n)
        ref_ng = _ngrams(ref_tokens, n)
        if not hyp_ng:
            continue
        overlap = sum((hyp_ng & ref_ng).values())
        p_n = overlap / max(sum(hyp_ng.values()), 1)
        if p_n > 0:
            log_avg += math.log(p_n)
            valid_n += 1

    if valid_n == 0:
        return 0.0

    return round(bp * math.exp(log_avg / valid_n), 4)


# ─── Exact Match ─────────────────────────────────────────────────────────────

def exact_match(hypothesis: str, reference: str) -> bool:
    """True if normalized hypothesis equals normalized reference."""
    return " ".join(_tokenize(hypothesis)) == " ".join(_tokenize(reference))


# ─── Readability (Flesch-Kincaid Grade Level Proxy) ──────────────────────────

def flesch_kincaid_grade(text: str) -> float:
    """
    Approximate Flesch-Kincaid Grade Level.
    Lower is simpler (target: ≤ 5 for 5th-grade reading level).
    """
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words     = _tokenize(text)

    if not sentences or not words:
        return 0.0

    # Approximate syllable count: count vowel groups
    def syllables(word: str) -> int:
        count = len(re.findall(r"[aeiou]+", word.lower()))
        return max(count, 1)

    total_syllables = sum(syllables(w) for w in words)
    avg_sentence_len   = len(words) / len(sentences)
    avg_syllables_word = total_syllables / len(words)

    grade = 0.39 * avg_sentence_len + 11.8 * avg_syllables_word - 15.59
    return round(max(grade, 0.0), 2)


# ─── Evaluator ───────────────────────────────────────────────────────────────

class Evaluator:
    """
    Collects per-query evaluation records and aggregates metrics.

    Typical usage:
        ev = Evaluator()

        # After each RAG response:
        ev.record(
            question     = "How do I apply for housing aid?",
            answer       = result["answer"],
            ground_truth = "1. Check eligibility 2. Prepare documents ...",
            language     = result["language"],
            confidence   = result["confidence"],
            latency_ms   = result["latency_ms"],
        )

        # Get the full evaluation report:
        report = ev.report()
    """

    def __init__(self, persist_fn: Optional[Callable[[dict], None]] = None):
        self._records: list[dict] = []
        self._persist_fn = persist_fn

    # ── Record a single Q&A interaction ──────────────────────────────────

    def record(
        self,
        question:           str,
        answer:             str,
        ground_truth:       Optional[str] = None,
        language:           str = "en",
        confidence:         float = 0.0,
        latency_ms:         int = 0,
        document_id:        str = "",
        faithfulness_score: Optional[float] = None,
    ) -> dict:
        """
        Compute metrics for one Q&A pair and store the record.

        ground_truth is optional. When provided, ROUGE/BLEU/EM are computed.
        When absent, only readability and confidence metrics are available.

        Returns the computed metric dict for this record.
        """
        metrics: dict = {
            "timestamp":   datetime.utcnow().isoformat() + "Z",
            "language":    language,
            "confidence":  confidence,
            "latency_ms":  latency_ms,
            "document_id": document_id,
            # Readability (always computed)
            "fk_grade":    flesch_kincaid_grade(answer),
        }

        if faithfulness_score is not None:
            metrics["faithfulness_score"] = round(faithfulness_score, 4)

        if ground_truth:
            r1 = rouge_n(answer, ground_truth, 1)
            r2 = rouge_n(answer, ground_truth, 2)
            rl = rouge_l(answer, ground_truth)
            bl = bleu_score(answer, ground_truth)
            em = exact_match(answer, ground_truth)

            metrics.update({
                "rouge1_f1":  r1["f1"],
                "rouge2_f1":  r2["f1"],
                "rougeL_f1":  rl["f1"],
                "bleu":       bl,
                "exact_match": em,
                "has_ground_truth": True,
            })
        else:
            metrics["has_ground_truth"] = False

        record = {
            "question":     question[:300],
            "answer_len":   len(answer),
            **metrics,
        }
        self._records.append(record)
        logger.info(
            "[Eval] Recorded — lang=%s conf=%.3f latency=%dms fk_grade=%.1f%s",
            language, confidence, latency_ms, metrics["fk_grade"],
            f" rouge1={metrics['rouge1_f1']:.3f}" if ground_truth else "",
        )
        if self._persist_fn:
            try:
                self._persist_fn(record)
            except Exception as exc:
                logger.warning("[Eval] Persistence failed: %s", exc)
        return record

    # ── Aggregate report ─────────────────────────────────────────────────

    def report(self) -> dict:
        """
        Build an aggregated evaluation report from all recorded interactions.

        Returns a dict suitable for JSON serialization and display in the
        /api/eval endpoint.
        """
        if not self._records:
            return {
                "status": "no_data",
                "message": "No evaluation records yet. Ask the system some questions first.",
                "total_queries": 0,
            }

        n = len(self._records)
        graded = [r for r in self._records if r.get("has_ground_truth")]

        # ── Latency percentiles ───────────────────────────────────────────
        latencies = sorted(r["latency_ms"] for r in self._records)
        p50 = latencies[int(n * 0.50)]
        p95 = latencies[min(int(n * 0.95), n - 1)]
        p99 = latencies[min(int(n * 0.99), n - 1)]

        # ── Confidence stats ──────────────────────────────────────────────
        confidences = [r["confidence"] for r in self._records]
        avg_confidence = round(sum(confidences) / n, 4)

        # ── Readability stats ─────────────────────────────────────────────
        grades = [r["fk_grade"] for r in self._records]
        avg_grade = round(sum(grades) / n, 2)
        pct_simple = round(sum(1 for g in grades if g <= 6) / n * 100, 1)

        # ── ROUGE / BLEU (only when ground truth available) ───────────────
        rouge_bleu: dict = {}
        if graded:
            ng = len(graded)
            rouge_bleu = {
                "samples_with_ground_truth": ng,
                "avg_rouge1_f1": round(sum(r["rouge1_f1"] for r in graded) / ng, 4),
                "avg_rouge2_f1": round(sum(r["rouge2_f1"] for r in graded) / ng, 4),
                "avg_rougeL_f1": round(sum(r["rougeL_f1"] for r in graded) / ng, 4),
                "avg_bleu":      round(sum(r["bleu"]       for r in graded) / ng, 4),
                "exact_match_rate": round(sum(1 for r in graded if r["exact_match"]) / ng * 100, 1),
            }

        # ── Faithfulness (only queries with a score) ──────────────────────
        faithful_records = [r for r in self._records if r.get("faithfulness_score") is not None]
        faithfulness_stats: dict = {}
        if faithful_records:
            nf = len(faithful_records)
            faithfulness_stats = {
                "scored_queries": nf,
                "avg_faithfulness_score": round(
                    sum(r["faithfulness_score"] for r in faithful_records) / nf, 4
                ),
            }

        # ── Per-language breakdown ────────────────────────────────────────
        lang_stats: dict = defaultdict(lambda: {"count": 0, "total_conf": 0.0,
                                                  "total_latency": 0, "total_grade": 0.0})
        for r in self._records:
            ls = lang_stats[r["language"]]
            ls["count"]         += 1
            ls["total_conf"]    += r["confidence"]
            ls["total_latency"] += r["latency_ms"]
            ls["total_grade"]   += r["fk_grade"]

        per_language = {}
        for lang, ls in lang_stats.items():
            c = ls["count"]
            per_language[lang] = {
                "queries":        c,
                "avg_confidence": round(ls["total_conf"]    / c, 4),
                "avg_latency_ms": round(ls["total_latency"] / c),
                "avg_fk_grade":   round(ls["total_grade"]   / c, 2),
            }

        # ── Build final report ────────────────────────────────────────────
        report_data = {
            "status":        "ok",
            "generated_at":  datetime.utcnow().isoformat() + "Z",
            "total_queries": n,

            "latency": {
                "p50_ms": p50,
                "p95_ms": p95,
                "p99_ms": p99,
                "avg_ms": round(sum(latencies) / n),
            },

            "retrieval": {
                "avg_confidence":       avg_confidence,
                "pct_above_threshold":  round(
                    sum(1 for c in confidences if c >= 0.50) / n * 100, 1
                ),
            },

            "readability": {
                "avg_fk_grade":        avg_grade,
                "pct_simple_language": pct_simple,
                "target_grade":        5,
                "note": (
                    "✅ Meeting 5th-grade target" if avg_grade <= 6
                    else "⚠️ Above 5th-grade target — review simplification prompts"
                ),
            },

            "per_language": per_language,
        }

        if faithfulness_stats:
            report_data["faithfulness"] = faithfulness_stats

        if rouge_bleu:
            report_data["generation_quality"] = rouge_bleu

        return report_data

    def to_json(self) -> str:
        return json.dumps(self.report(), indent=2)

    def clear(self):
        self._records.clear()
        logger.info("[Eval] Records cleared.")

    def __len__(self):
        return len(self._records)


# ─── Document Category Detection ────────────────────────────────────────────────
# Maps document names / keywords to test case category.
# Used by run-test-suite-stream to only run relevant test cases.

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "housing": [
        "housing", "perumahan", "rumah", "house", "home", "PR1MA", "PPR",
        "bantuan perumahan", "residential", "apartment", "flat",
        "NUP", "PPA1M", "MyHome", "rent", "sewa",
    ],
    "healthcare": [
        "health", "kesihatan", "hospital", "clinic", "klinik", "medical",
        "perubatan", "peka", "medicine", "ubat", "rawatan", "treatment",
        "doctor", "pharmacy", "farmasi",
    ],
    "student_loans": [
        "PTPTN", "student loan", "pinjaman", "scholarship", "biasiswa",
        "education", "pendidikan", "university", "universiti", "college",
        "kolej", "loan", "repayment", "bayar balik",
    ],
    "social_welfare": [
        "welfare", "kebajikan", "JKM", "bantuan", "BR1M", "STR", "rahmah",
        "e-kasih", "OKU", "disability", "kurang upaya", "poverty", "miskin",
        "social", "sosial", "zakat",
    ],
    "immigration": [
        "immigration", "imigresen", "visa", "permit", "passport", "pasport",
        "migrant", "pendatang", "work permit", "foreigner", "warga asing",
        "citizenship", "kewarganegaraan",
    ],
}

# Keywords that clearly indicate an unrelated / non-gov-services document
UNRELATED_KEYWORDS: list[str] = [
    "data sharing", "data protection", "cybersecurity", "act 2025",
    "traffic", "lalu lintas", "companies act", "akta syarikat",
    "income tax", "cukai pendapatan", "financial services",
    "penal code", "criminal", "jenayah", "evidence act", "contract act",
    "intellectual property", "patent", "trademark",
]


def detect_document_category(doc_name: str, doc_id: str = "") -> "str | None":
    """
    Detect the most likely government service category from a document name.

    Returns:
        Category string ("housing", "healthcare", etc.) or None if unrelated/unknown.
    """
    text = (doc_name + " " + doc_id).lower()

    # Check if document is clearly unrelated
    for kw in UNRELATED_KEYWORDS:
        if kw in text:
            return None

    # Score each category by keyword hits
    scores: dict = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > 0:
            scores[category] = score

    if not scores:
        return None

    return max(scores, key=lambda c: scores[c])


def get_test_cases_for_document(doc_name: str, doc_id: str = "") -> "tuple[list, str | None]":
    """
    Return the subset of BUILT_IN_TEST_CASES matching the document category.

    Returns:
        (matching_cases, detected_category)
        If unrelated doc: ([], None).
    """
    category = detect_document_category(doc_name, doc_id)
    if category is None:
        return [], None
    matching = [c for c in BUILT_IN_TEST_CASES if c.get("category") == category]
    return (matching if matching else BUILT_IN_TEST_CASES), category


# ─── Built-in Test Dataset (Ground Truth) ────────────────────────────────────
# A small set of representative Q&A pairs used to demonstrate evaluation.
# In production, expand this with real annotated pairs from a domain expert.

# ─── Annotated Test Dataset (30 cases) ──────────────────────────────────────
# Covers: housing aid, healthcare assistance, student loans, social welfare,
# immigration — in English (en), Malay (ms), and Chinese (zh-cn).
# Ground truth answers follow the 3-5 bullet point format the LLM is prompted
# to produce. Used by POST /api/eval/run-test-suite for ROUGE/BLEU scoring.

BUILT_IN_TEST_CASES: list[dict] = [

    # ── Housing Aid (EN) ─────────────────────────────────────────────────────
    {
        "language": "en",
        "category": "housing",
        "question": "How do I apply for housing aid?",
        "ground_truth": (
            "• Check if you are eligible by visiting the official portal.\n"
            "• Prepare your identity card and income statement.\n"
            "• Submit your application online through the government website.\n"
            "• Wait 14 to 30 days for your application to be approved."
        ),
    },
    {
        "language": "en",
        "category": "housing",
        "question": "Who is eligible for government housing assistance?",
        "ground_truth": (
            "• Malaysian citizens with a monthly household income below RM3,000.\n"
            "• First-time home buyers who do not own any property.\n"
            "• Applicants must be at least 18 years old.\n"
            "• Priority is given to married couples and single parents."
        ),
    },
    {
        "language": "en",
        "category": "housing",
        "question": "What documents do I need for a housing aid application?",
        "ground_truth": (
            "• Identity card (MyKad) for all household members.\n"
            "• Latest income statement or payslip.\n"
            "• Proof of residence such as a utility bill.\n"
            "• Completed application form from the official portal."
        ),
    },
    {
        "language": "en",
        "category": "housing",
        "question": "How long does housing aid approval take?",
        "ground_truth": (
            "• Processing usually takes 14 to 30 working days.\n"
            "• You will receive an SMS or email when your application is reviewed.\n"
            "• Incomplete applications take longer — make sure all documents are attached.\n"
            "• You can check your application status online at any time."
        ),
    },
    {
        "language": "en",
        "category": "housing",
        "question": "Can I appeal if my housing aid application is rejected?",
        "ground_truth": (
            "• Yes, you can submit an appeal within 30 days of rejection.\n"
            "• Write a letter explaining why you think the decision should be changed.\n"
            "• Attach any new supporting documents to strengthen your case.\n"
            "• Send the appeal to the same department that processed your application."
        ),
    },

    # ── Housing Aid (MS) ─────────────────────────────────────────────────────
    {
        "language": "ms",
        "category": "housing",
        "question": "Bagaimana nak mohon bantuan perumahan?",
        "ground_truth": (
            "• Semak kelayakan anda di portal rasmi kerajaan.\n"
            "• Sediakan dokumen seperti IC dan penyata pendapatan.\n"
            "• Hantar permohonan melalui laman web kerajaan.\n"
            "• Tempoh kelulusan biasanya 14 hingga 30 hari bekerja."
        ),
    },
    {
        "language": "ms",
        "category": "housing",
        "question": "Siapa yang layak mendapat bantuan perumahan kerajaan?",
        "ground_truth": (
            "• Warganegara Malaysia dengan pendapatan isi rumah di bawah RM3,000 sebulan.\n"
            "• Pembeli rumah pertama yang tidak memiliki sebarang harta.\n"
            "• Pemohon mestilah berumur sekurang-kurangnya 18 tahun.\n"
            "• Keutamaan diberikan kepada pasangan berkahwin dan ibu bapa tunggal."
        ),
    },
    {
        "language": "ms",
        "category": "housing",
        "question": "Berapa lama masa kelulusan bantuan perumahan?",
        "ground_truth": (
            "• Pemprosesan biasanya mengambil masa 14 hingga 30 hari bekerja.\n"
            "• Anda akan menerima SMS atau e-mel apabila permohonan disemak.\n"
            "• Permohonan tidak lengkap mengambil masa lebih lama.\n"
            "• Anda boleh semak status permohonan secara dalam talian pada bila-bila masa."
        ),
    },

    # ── Healthcare Assistance (EN) ───────────────────────────────────────────
    {
        "language": "en",
        "category": "healthcare",
        "question": "How do I get free or subsidised healthcare in Malaysia?",
        "ground_truth": (
            "• Malaysian citizens can get subsidised treatment at government clinics and hospitals.\n"
            "• Bring your MyKad — you will only pay a small fee of RM1 to RM5 per visit.\n"
            "• For specialist care, you need a referral letter from a government clinic.\n"
            "• Low-income families may qualify for free treatment under the Bantuan Kesihatan scheme."
        ),
    },
    {
        "language": "en",
        "category": "healthcare",
        "question": "What is the PeKa B40 health programme?",
        "ground_truth": (
            "• PeKa B40 is a free health screening programme for low-income Malaysians.\n"
            "• It covers screenings for diabetes, high blood pressure, and certain cancers.\n"
            "• You are eligible if your household income is below RM2,500 per month.\n"
            "• Register at your nearest government clinic or through the MySejahtera app."
        ),
    },
    {
        "language": "en",
        "category": "healthcare",
        "question": "How do I get medicine for free at a government hospital?",
        "ground_truth": (
            "• Bring your MyKad and your doctor's prescription to the hospital pharmacy.\n"
            "• Patients from the B40 income group pay only RM1 per prescription.\n"
            "• Chronic disease medicines like insulin and blood pressure pills are heavily subsidised.\n"
            "• Show your Kad OKU or B40 certificate if you have one to get further discounts."
        ),
    },
    {
        "language": "en",
        "category": "healthcare",
        "question": "What should I do if I cannot afford hospital bills?",
        "ground_truth": (
            "• Tell the hospital social worker that you cannot afford to pay.\n"
            "• Apply for a bill waiver or reduction through the hospital's welfare unit.\n"
            "• Bring proof of income such as a payslip or a letter from your employer.\n"
            "• The hospital can also set up a payment plan so you pay in small instalments."
        ),
    },

    # ── Healthcare Assistance (MS) ───────────────────────────────────────────
    {
        "language": "ms",
        "category": "healthcare",
        "question": "Bagaimana nak dapatkan rawatan percuma di hospital kerajaan?",
        "ground_truth": (
            "• Warganegara Malaysia boleh mendapat rawatan bersubsidi di klinik dan hospital kerajaan.\n"
            "• Bawa MyKad anda — yuran adalah sangat kecil iaitu RM1 hingga RM5 sahaja.\n"
            "• Untuk rawatan pakar, anda perlukan surat rujukan dari klinik kerajaan.\n"
            "• Keluarga berpendapatan rendah mungkin layak mendapat rawatan percuma."
        ),
    },
    {
        "language": "ms",
        "category": "healthcare",
        "question": "Apa itu program PeKa B40?",
        "ground_truth": (
            "• PeKa B40 adalah program saringan kesihatan percuma untuk rakyat berpendapatan rendah.\n"
            "• Ia merangkumi saringan kencing manis, darah tinggi, dan beberapa jenis kanser.\n"
            "• Anda layak jika pendapatan isi rumah di bawah RM2,500 sebulan.\n"
            "• Daftar di klinik kerajaan berhampiran atau melalui aplikasi MySejahtera."
        ),
    },

    # ── Student Loans (EN) ───────────────────────────────────────────────────
    {
        "language": "en",
        "category": "student_loans",
        "question": "How do I apply for a PTPTN student loan?",
        "ground_truth": (
            "• Register an account on the PTPTN official website at ptptn.gov.my.\n"
            "• Fill in the online application form with your personal and academic details.\n"
            "• Upload your MyKad, latest results slip, and offer letter from your institution.\n"
            "• Submit the application and wait for approval — usually 2 to 4 weeks."
        ),
    },
    {
        "language": "en",
        "category": "student_loans",
        "question": "Who is eligible for a PTPTN loan?",
        "ground_truth": (
            "• Malaysian citizens enrolled in approved public or private higher education.\n"
            "• Students in diploma, degree, or professional certificate programmes.\n"
            "• Your household income must be below RM8,000 per month to qualify.\n"
            "• Students with higher grades or low-income backgrounds may get larger loans."
        ),
    },
    {
        "language": "en",
        "category": "student_loans",
        "question": "How do I repay my PTPTN loan?",
        "ground_truth": (
            "• Repayment starts one year after you finish your studies.\n"
            "• You can repay monthly through salary deduction or direct bank transfer.\n"
            "• The minimum monthly payment is RM50 — you can pay more to finish faster.\n"
            "• Early full repayment gets you a 10% discount on the remaining balance."
        ),
    },
    {
        "language": "en",
        "category": "student_loans",
        "question": "Can I get my PTPTN loan converted to a scholarship?",
        "ground_truth": (
            "• Yes — if you graduate with first class honours, your loan becomes a scholarship.\n"
            "• Apply for conversion within 6 months of receiving your official results.\n"
            "• Submit your transcript and graduation certificate to PTPTN.\n"
            "• This means you do not need to repay the loan at all."
        ),
    },

    # ── Student Loans (MS) ───────────────────────────────────────────────────
    {
        "language": "ms",
        "category": "student_loans",
        "question": "Bagaimana cara mohon pinjaman PTPTN?",
        "ground_truth": (
            "• Daftar akaun di laman web rasmi PTPTN di ptptn.gov.my.\n"
            "• Isi borang permohonan dalam talian dengan maklumat peribadi dan akademik.\n"
            "• Muat naik MyKad, slip keputusan terkini, dan surat tawaran institusi anda.\n"
            "• Hantar permohonan dan tunggu kelulusan — biasanya 2 hingga 4 minggu."
        ),
    },
    {
        "language": "ms",
        "category": "student_loans",
        "question": "Siapa yang layak mendapat pinjaman PTPTN?",
        "ground_truth": (
            "• Warganegara Malaysia yang mendaftar di institusi pengajian tinggi yang diluluskan.\n"
            "• Pelajar dalam program diploma, ijazah, atau sijil profesional.\n"
            "• Pendapatan isi rumah mesti di bawah RM8,000 sebulan untuk layak.\n"
            "• Pelajar dengan keputusan cemerlang atau latar belakang berpendapatan rendah mungkin mendapat pinjaman lebih besar."
        ),
    },
    {
        "language": "ms",
        "category": "student_loans",
        "question": "Bagaimana cara bayar balik pinjaman PTPTN?",
        "ground_truth": (
            "• Pembayaran balik bermula satu tahun selepas anda tamat pengajian.\n"
            "• Anda boleh bayar setiap bulan melalui potongan gaji atau pindahan bank terus.\n"
            "• Pembayaran minimum ialah RM50 sebulan — anda boleh bayar lebih untuk selesai lebih cepat.\n"
            "• Pembayaran penuh awal mendapat diskaun 10 peratus pada baki yang tinggal."
        ),
    },

    # ── Social Welfare (EN) ──────────────────────────────────────────────────
    {
        "language": "en",
        "category": "social_welfare",
        "question": "What is Bantuan Rakyat 1Malaysia (BR1M) or Sumbangan Tunai Rahmah?",
        "ground_truth": (
            "• It is a cash aid programme for low-income Malaysian households.\n"
            "• Eligible households receive between RM100 and RM1,000 per year depending on income.\n"
            "• You must register through e-Kasih or the official government portal.\n"
            "• Payment is made directly to your bank account or through the post office."
        ),
    },
    {
        "language": "en",
        "category": "social_welfare",
        "question": "How do I apply for welfare assistance (Jabatan Kebajikan Masyarakat)?",
        "ground_truth": (
            "• Visit your nearest JKM office or apply online at ebk.jkm.gov.my.\n"
            "• Bring your MyKad, proof of income, and any supporting documents.\n"
            "• A JKM officer will visit your home to assess your situation.\n"
            "• Assistance types include monthly cash aid, food baskets, and medical help."
        ),
    },
    {
        "language": "en",
        "category": "social_welfare",
        "question": "What help is available for persons with disabilities (OKU)?",
        "ground_truth": (
            "• Register as OKU at the nearest JKM office to access government benefits.\n"
            "• Benefits include monthly financial aid, free medical care, and tax exemptions.\n"
            "• OKU card holders get discounts on public transport and utility bills.\n"
            "• Children with disabilities may qualify for free special education programmes."
        ),
    },

    # ── Immigration (EN) ─────────────────────────────────────────────────────
    {
        "language": "en",
        "category": "immigration",
        "question": "How do migrant workers renew their work permit in Malaysia?",
        "ground_truth": (
            "• Your employer is responsible for renewing your work permit before it expires.\n"
            "• Bring your passport, current permit, and medical check-up results.\n"
            "• Your employer submits the application through the Immigration Department portal.\n"
            "• Renewal usually takes 2 to 4 weeks — stay on valid status until it is done."
        ),
    },
    {
        "language": "en",
        "category": "immigration",
        "question": "What should I do if my visa is expired?",
        "ground_truth": (
            "• Do not wait — overstaying is a serious offence with heavy fines.\n"
            "• Go to the nearest Immigration Department office as soon as possible.\n"
            "• Bring your passport and any documents explaining your situation.\n"
            "• You may be fined but can apply to regularise your status in some cases."
        ),
    },

    # ── Chinese / Multilingual ───────────────────────────────────────────────
    {
        "language": "zh-cn",
        "category": "housing",
        "question": "如何申请政府房屋援助？",
        "ground_truth": (
            "• 访问官方门户网站检查您是否符合资格。\n"
            "• 准备身份证和收入证明文件。\n"
            "• 通过政府网站在线提交申请。\n"
            "• 审批通常需要14至30个工作日。"
        ),
    },
    {
        "language": "zh-cn",
        "category": "student_loans",
        "question": "如何申请PTPTN学生贷款？",
        "ground_truth": (
            "• 在PTPTN官方网站ptptn.gov.my注册账户。\n"
            "• 填写在线申请表格，填写个人和学术信息。\n"
            "• 上传身份证、最新成绩单和大学录取通知书。\n"
            "• 提交申请并等待批准，通常需要2至4周。"
        ),
    },
    {
        "language": "zh-cn",
        "category": "healthcare",
        "question": "如何在政府医院获得免费或补贴医疗？",
        "ground_truth": (
            "• 马来西亚公民可在政府诊所和医院获得补贴治疗。\n"
            "• 携带身份证，每次就诊只需支付RM1至RM5的小额费用。\n"
            "• 专科护理需要政府诊所的转介信。\n"
            "• 低收入家庭可能有资格获得免费治疗。"
        ),
    },
]
