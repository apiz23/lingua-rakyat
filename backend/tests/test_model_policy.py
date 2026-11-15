"""Client-supplied model overrides must never reach the provider unfiltered."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import rag_pipeline


def test_configured_models_are_accepted(monkeypatch):
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL_FAST", "llama-3.1-8b-instant")

    assert (
        rag_pipeline._normalize_model_name("llama-3.1-8b-instant")
        == "llama-3.1-8b-instant"
    )
    assert (
        rag_pipeline._normalize_model_name("  OpenAI/GPT-OSS-120B ")
        == "openai/gpt-oss-120b"
    )


def test_unknown_model_override_falls_back_to_default(monkeypatch):
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL_FAST", "llama-3.1-8b-instant")

    assert (
        rag_pipeline._normalize_model_name("some-vendor/expensive-model")
        == "openai/gpt-oss-120b"
    )
    assert rag_pipeline._normalize_model_name("") == "openai/gpt-oss-120b"
    assert rag_pipeline._normalize_model_name(None) == "openai/gpt-oss-120b"


def test_empty_configuration_denies_every_override(monkeypatch):
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL", "")
    monkeypatch.setattr(rag_pipeline, "GROQ_MODEL_FAST", "")

    assert rag_pipeline._normalize_model_name("llama-3.1-8b-instant") == ""
