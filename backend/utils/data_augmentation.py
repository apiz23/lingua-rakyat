"""
utils/data_augmentation.py - Data augmentation helpers for multilingual retrieval.
"""

import logging
import os
import re
import time
from typing import Optional

import requests

logger = logging.getLogger("data_augmentation")

JARGON_SIMPLIFICATION: dict[str, str] = {
    "pursuant to": "under",
    "hereinafter referred to": "called",
    "notwithstanding": "even though",
    "aforementioned": "mentioned above",
    "in lieu of": "instead of",
    "per annum": "per year",
    "remuneration": "pay / salary",
    "eligibility criteria": "who can apply",
    "means-tested": "based on income",
    "subsidy": "financial help",
    "disbursement": "payment / payout",
    "applicant": "person applying",
    "submission": "sending in / applying",
    "documentation": "documents / papers",
    "verification": "checking / confirming",
    "encumbrance": "debt or claim on property",
    "beneficiary": "person who receives help",
    "stipulated": "stated / required",
    "commencement": "start / beginning",
    "cessation": "end / stopping",
    "comply with": "follow",
    "undertake": "agree to do",
    "subject to approval": "if approved",
    "outpatient": "clinic visit (not staying overnight)",
    "inpatient": "hospital stay",
    "consultation": "doctor visit",
    "pharmaceutical": "medicine",
    "chronic illness": "long-term health condition",
    "fiscal year": "financial year",
    "gross income": "total income before tax",
    "net income": "income after tax",
    "levy": "fee / charge",
    "exemption": "being left out / not required to pay",
}

JARGON_SIMPLIFICATION_MS: dict[str, str] = {
    "pemohon": "orang yang memohon",
    "permohonan": "permintaan / borang",
    "kelayakan": "syarat untuk layak",
    "pendapatan isi rumah": "pendapatan keluarga",
    "pengesahan": "pengesahan / semak",
    "pembayaran balik": "bayar balik",
    "subsidi": "bantuan kewangan",
    "peruntukan": "bajet / wang yang disediakan",
    "berkuat kuasa": "mula berlaku",
    "tertakluk kepada": "bergantung kepada",
}


def simplify_jargon(text: str, lang: str = "en") -> str:
    lookup = JARGON_SIMPLIFICATION if lang == "en" else JARGON_SIMPLIFICATION_MS
    result = text
    text_lower = text.lower()
    for jargon, simple in lookup.items():
        if jargon in text_lower:
            result = re.sub(re.escape(jargon), simple, result, flags=re.IGNORECASE)
    return result


class QueryAugmenter:
    SUPPORTED_LANGUAGES = {
        "en": "English",
        "ms": "Malay (Bahasa Malaysia)",
        "zh-cn": "Simplified Chinese",
        "id": "Indonesian (Bahasa Indonesia)",
        "tl": "Filipino (Tagalog)",
    }

    def __init__(self):
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.groq_model = os.getenv("GROQ_MODEL", "groq/compound")
        self._cache: dict[str, list[tuple[str, str]]] = {}
        self._rate_limited_until = 0.0

    def _call_groq(self, prompt: str, max_tokens: int = 300) -> Optional[str]:
        if not self.groq_key:
            logger.warning("[Augment] GROQ_API_KEY not set - skipping augmentation")
            return None
        if time.time() < self._rate_limited_until:
            logger.warning("[Augment] Skipping augmentation during Groq cooldown window")
            return None

        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.groq_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                timeout=6,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code == 429:
                self._rate_limited_until = time.time() + 60
                logger.warning("[Augment] Groq rate limited - disabling augmentation for 60s")
            logger.error("[Augment] Groq call failed: %s", exc)
            return None

    def translate_query(self, query: str, target_lang: str) -> Optional[str]:
        lang_name = self.SUPPORTED_LANGUAGES.get(target_lang, target_lang)
        prompt = (
            f"Translate the following question into {lang_name}. "
            f"Output ONLY the translated question, nothing else.\n\n"
            f"Question: {query}"
        )
        return self._call_groq(prompt, max_tokens=150)

    def paraphrase_query(self, query: str, source_lang: str = "en") -> Optional[str]:
        lang_name = self.SUPPORTED_LANGUAGES.get(source_lang, "English")
        prompt = (
            f"Rewrite this question in simpler {lang_name} words that a person "
            f"with low literacy could understand. Use short, everyday words. "
            f"Output ONLY the rewritten question.\n\nQuestion: {query}"
        )
        return self._call_groq(prompt, max_tokens=150)

    def expand_query(
        self,
        query: str,
        source_lang: str = "en",
        target_langs: Optional[list[str]] = None,
        include_paraphrase: bool = True,
    ) -> dict[str, str]:
        cache_key = f"{query}|{source_lang}|{','.join(target_langs or [])}|{include_paraphrase}"
        if cache_key in self._cache:
            cached_variants = self._cache[cache_key]
            return {source_lang: query, **{key: text for key, text in cached_variants}}

        variants: dict[str, str] = {source_lang: query}
        if target_langs is None:
            target_langs = [lang for lang in self.SUPPORTED_LANGUAGES if lang != source_lang]

        for lang in target_langs:
            translated = self.translate_query(query, lang)
            if translated:
                variants[lang] = translated
                logger.info("[Augment] Translated to %s: %s", lang, translated[:60])

        if include_paraphrase:
            paraphrase = self.paraphrase_query(query, source_lang)
            if paraphrase:
                variants[f"paraphrase_{source_lang}"] = paraphrase
                logger.info("[Augment] Paraphrase: %s", paraphrase[:60])

        self._cache[cache_key] = [(key, text) for key, text in variants.items() if key != source_lang]
        return variants

    def augment_test_dataset(self, base_cases: list[dict]) -> list[dict]:
        augmented = list(base_cases)
        for case in base_cases:
            variants = self.expand_query(
                case["question"],
                source_lang=case["language"],
                include_paraphrase=True,
            )
            for lang, translated_q in variants.items():
                if lang == case["language"]:
                    continue
                augmented.append({
                    "language": lang.replace("paraphrase_", ""),
                    "question": translated_q,
                    "ground_truth": case["ground_truth"],
                    "augmented": True,
                    "source_case": case["question"][:50],
                })

        logger.info(
            "[Augment] Dataset expanded: %d original -> %d total cases",
            len(base_cases), len(augmented),
        )
        return augmented


def generate_data_quality_report(quality_metrics_list: list[dict]) -> dict:
    if not quality_metrics_list:
        return {"status": "no_data", "documents_processed": 0}

    n = len(quality_metrics_list)
    valid = [m for m in quality_metrics_list if m.get("valid")]
    invalid = [m for m in quality_metrics_list if not m.get("valid")]

    total_chars = sum(m.get("char_count", 0) for m in valid)
    total_pages = sum(m.get("page_count", 0) for m in valid)
    empty_pages = sum(m.get("empty_pages", 0) for m in valid)

    return {
        "status": "ok",
        "documents_processed": n,
        "valid_documents": len(valid),
        "invalid_documents": len(invalid),
        "invalid_reasons": [m.get("error") for m in invalid if m.get("error")],
        "totals": {
            "total_pages": total_pages,
            "total_chars": total_chars,
            "empty_pages": empty_pages,
        },
        "averages": {
            "avg_pages_per_doc": round(total_pages / max(len(valid), 1), 1),
            "avg_chars_per_doc": round(total_chars / max(len(valid), 1)),
            "avg_chars_per_page": round(total_chars / max(total_pages, 1), 1),
            "empty_page_rate_pct": round(empty_pages / max(total_pages, 1) * 100, 1),
        },
        "data_quality_score": round(len(valid) / n * 100, 1),
        "note": (
            f"{len(valid)}/{n} documents passed validation "
            f"({round(len(valid) / n * 100)}% data quality score)"
        ),
    }
