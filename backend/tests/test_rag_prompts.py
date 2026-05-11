import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.rag_pipeline import _cautious_qa_prompt


def _build_qa_prompt(lang, question, context):
    """Thin adapter matching the task spec signature → delegates to the real function."""
    return _cautious_qa_prompt(context=context, question=question, lang=lang)


def test_zh_cn_prompt_is_valid_unicode():
    prompt = _build_qa_prompt("zh-cn", "什么是公积金？", "context here")
    assert "ä½" not in prompt, "Prompt contains mojibake — UTF-8 was misread as Latin-1"
    assert "你是" in prompt, "Expected Chinese characters in prompt"


def test_zh_cn_prompt_contains_context_and_question():
    prompt = _build_qa_prompt("zh-cn", "什么是公积金？", "some context")
    assert "some context" in prompt
    assert "什么是公积金？" in prompt


def test_en_and_ms_prompts_unchanged():
    en = _build_qa_prompt("en", "test?", "ctx")
    ms = _build_qa_prompt("ms", "test?", "ctx")
    assert "You are a cautious" in en or "You are a careful" in en
    assert "Anda ialah" in ms
