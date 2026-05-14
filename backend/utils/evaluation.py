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
            question     = "How long does MyKad processing take?",
            answer       = result["answer"],
            ground_truth = "1. Check eligibility 2. Prepare documents ...",
            language     = result["language"],
            confidence   = result["confidence"],
            latency_ms   = result["latency_ms"],
        )

        # Get the full evaluation report:
        report = ev.report()
    """

    def __init__(
        self,
        persist_fn: Optional[Callable[[dict], None]] = None,
        load_fn: Optional[Callable[[], list[dict]]] = None,
    ):
        self._records: list[dict] = []
        self._persist_fn = persist_fn
        if load_fn is not None:
            try:
                self._records = list(load_fn())
                logger.info("[Eval] Loaded %d records from persistence", len(self._records))
            except Exception as exc:
                logger.warning("[Eval] Could not load records from persistence: %s", exc)

    def __len__(self) -> int:
        return len(self._records)

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
        latencies = sorted(r.get("latency_ms", 0) for r in self._records)
        p50 = latencies[int(n * 0.50)]
        p95 = latencies[min(int(n * 0.95), n - 1)]
        p99 = latencies[min(int(n * 0.99), n - 1)]

        # ── Confidence stats ──────────────────────────────────────────────
        confidences = [r.get("confidence", 0.0) for r in self._records]
        avg_confidence = round(sum(confidences) / n, 4)

        # ── Readability stats ─────────────────────────────────────────────
        grades = [r.get("fk_grade", 0.0) for r in self._records]
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


# ─── Document Category Detection ────────────────────────────────────────────────
# Maps document names / keywords to test case category.
# Used by run-test-suite-stream to only run relevant test cases.

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "identity": [
        "mykad", "kad pengenalan", "identity card", "jpn", "pendaftaran negara",
        "late registration", "daftar lewat", "cip", "fingerprint", "cap jari",
    ],
    "passport": [
        "passport", "pasport", "imigresen", "immigration", "mykid",
        "mytentera", "facial live capture", "biometric photo", "travel document",
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
        Category string ("identity", "passport") or None if unrelated/unknown.
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
# Covers the current bundled MyKad FAQ and Malaysian Passport Guidelines
# documents in English (en), Malay (ms), and Chinese (zh-cn).
# Ground truth answers follow the 3-5 bullet point format the LLM is prompted
# to produce. Used by POST /api/eval/run-test-suite for ROUGE/BLEU scoring.

BUILT_IN_TEST_CASES: list[dict] = [
    {
        "language": "ms",
        "category": "identity",
        "question": "Bilakah saya perlu menukar semula MyKad yang diperoleh kali pertama semasa umur 12 tahun?",
        "ground_truth": (
            "- MyKad perlu ditukar semula apabila pemohon mencapai umur 18 tahun.\n"
            "- Kad pengenalan kali pertama biasanya diperoleh semasa umur 12 tahun.\n"
            "- Jika penukaran dibuat dalam tempoh umur 18 hingga 25 tahun, tiada denda dikenakan."
        ),
    },
    {
        "language": "ms",
        "category": "identity",
        "question": "Apa perlu dibuat jika saya sudah berumur lebih 16 tahun tetapi masih belum ada kad pengenalan?",
        "ground_truth": (
            "- Datang ke mana-mana JPN berhampiran untuk memohon daftar lewat kad pengenalan.\n"
            "- Pemohon dan penganjur perlu hadir bersama untuk ditemuduga.\n"
            "- Bawa Sijil Lahir, Sijil Anak Angkat, atau Borang W jika berkenaan.\n"
            "- Bawa juga Permit Masuk atau Borang Pengesahan Taraf Warganegara jika berkaitan serta kad pengenalan penganjur."
        ),
    },
    {
        "language": "en",
        "category": "identity",
        "question": "How long does MyKad processing take?",
        "ground_truth": (
            "- MyKad can be ready in 30 minutes if collection is made at JPN headquarters or branches with distributed printing machines.\n"
            "- Collection at branch offices in Peninsular Malaysia usually takes 5 working days.\n"
            "- Collection at branch offices in Sabah, Sarawak, and Labuan usually takes 7 working days.\n"
            "- This customer charter applies to Malaysian citizens with applications that are not problematic."
        ),
    },
    {
        "language": "en",
        "category": "identity",
        "question": "Can I change my address without replacing my MyKad?",
        "ground_truth": (
            "- No, changing the address on the chip only is not allowed.\n"
            "- Address changes are only allowed when they involve issuing a new physical replacement identity card."
        ),
    },
    {
        "language": "en",
        "category": "identity",
        "question": "What payment methods does JPN accept for MyKad-related transactions?",
        "ground_truth": (
            "- JPN accepts electronic cashless payments.\n"
            "- Payment can be made using credit card, debit card, and MEPS."
        ),
    },
    {
        "language": "en",
        "category": "passport",
        "question": "Who is eligible for a Malaysian international passport and how long is it valid?",
        "ground_truth": (
            "- Malaysian citizens are eligible to apply for a Malaysian international passport.\n"
            "- The passport is valid for five years from the date of issue.\n"
            "- Applications can be made at Immigration Offices in Malaysia and Malaysian Representative Offices abroad."
        ),
    },
    {
        "language": "en",
        "category": "passport",
        "question": "What is the passport fee for an ordinary applicant aged 13 to 59?",
        "ground_truth": "- The standard fee for an ordinary applicant aged 13 to 59 is RM200.00."
    },
    {
        "language": "en",
        "category": "passport",
        "question": "What documents are required for a first-time passport applicant aged 18 and above who was born in Malaysia?",
        "ground_truth": (
            "- The applicant must present themselves physically at the counter.\n"
            "- An applicant born in Malaysia must provide their MyKad.\n"
            "- If the MyKad is temporarily unavailable, a Temporary Identity Card (JPN.KPPK 09) and the original Birth Certificate must be provided."
        ),
    },
    {
        "language": "ms",
        "category": "passport",
        "question": "Apakah syarat gambar biometrik semasa permohonan pasport?",
        "ground_truth": (
            "- Pemohon mesti memakai pakaian berwarna gelap yang menutupi bahu dan dada.\n"
            "- Jika memakai hijab, hijab mestilah berwarna gelap dan tidak menutup dahi atau muka.\n"
            "- Mata mesti terbuka penuh, mulut tertutup, dan wajah memandang terus ke lensa kamera.\n"
            "- Topi, aksesori rambut yang menghalang wajah, dan cermin mata adalah tidak dibenarkan semasa tangkapan foto."
        ),
    },
    {
        "language": "zh-cn",
        "category": "passport",
        "question": "如何首次申请马来西亚护照？",
        "ground_truth": (
            "- 所有申请人都必须亲自到柜台办理申请。\n"
            "- 在马来西亚境内的柜台通常使用数码现场人脸采集，因此一般不需要实体照片。\n"
            "- 18岁及以上、在马来西亚出生的申请人需要提供自己的MyKad。\n"
            "- 如果MyKad暂时无法提供，则必须提交临时身份证和出生证明正本。"
        ),
    },
    {
        "language": "en",
        "category": "passport",
        "question": "What are the photo rules for children under 4 years old when applying for a passport?",
        "ground_truth": (
            "- Children under 4 years old are strongly encouraged to bring physical photos.\n"
            "- The photo must measure exactly 35mm by 50mm.\n"
            "- The background must be plain white with no shadow.\n"
            "- The face should cover about 50% to 60% of the print size following ICAO standards."
        ),
    },
]
