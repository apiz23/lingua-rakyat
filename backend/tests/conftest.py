"""Shared test fixtures."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def _clear_document_catalogue_cache():
    """The in-process catalogue cache must never leak between tests."""
    from utils import catalogue_cache

    catalogue_cache.invalidate_documents()
    yield
    catalogue_cache.invalidate_documents()
