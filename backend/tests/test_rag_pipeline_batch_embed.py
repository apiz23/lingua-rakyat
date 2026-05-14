"""Test that _retrieve_matches calls get_embeddings_cohere exactly once."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
import utils.rag_pipeline as rag


def test_batch_embed_called_once_for_multiple_variants():
    variants = [
        {"key": "en", "text": "what is mykad", "variant_type": "original"},
        {"key": "ms", "text": "apakah mykad", "variant_type": "translation"},
        {"key": "zh-cn", "text": "什么是身份证", "variant_type": "translation"},
    ]
    fake_embeddings = [[0.1] * 1024, [0.2] * 1024, [0.3] * 1024]
    fake_pinecone_result = {"matches": []}

    with patch.object(rag, "get_embeddings_cohere", return_value=fake_embeddings) as mock_embed, \
         patch.object(rag, "_get_index") as mock_index, \
         patch.object(rag, "_cohere_rerank", side_effect=lambda q, m, k: m[:k]):
        mock_index.return_value.query.return_value = fake_pinecone_result
        rag._retrieve_matches("doc-123", variants, top_k=5)

    # Must be called exactly once with all 3 variant texts
    mock_embed.assert_called_once_with(
        ["what is mykad", "apakah mykad", "什么是身份证"],
        input_type="search_query",
    )

    # Verify each variant's embedding was sent to Pinecone in correct order
    calls = mock_index.return_value.query.call_args_list
    assert len(calls) == 3
    assert calls[0].kwargs["vector"] == [0.1] * 1024
    assert calls[1].kwargs["vector"] == [0.2] * 1024
    assert calls[2].kwargs["vector"] == [0.3] * 1024
