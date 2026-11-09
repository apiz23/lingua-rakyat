from datetime import timedelta
import sys
import pytest
from tests.test_ingestion import base_db, seed_job, NOW
from utils.ingestion import service
from utils import rag_pipeline
from scripts import ingestion_worker


def test_recovery_preserves_renewed_lease(monkeypatch):
    db = base_db()
    seed_job(db, status='running', worker_id='w', lease_expires_at=(NOW-timedelta(minutes=1)).isoformat())
    original = service._update
    def renew(client, table, filters, payload):
        db.tables[service.JOBS_TABLE][0]['lease_expires_at'] = (NOW+timedelta(minutes=30)).isoformat()
        return original(client, table, filters, payload)
    monkeypatch.setattr(service, '_update', renew)
    assert service.recover_stale_jobs(db) == 0
    assert db.tables[service.JOBS_TABLE][0]['status'] == 'running'


@pytest.mark.parametrize('embeddings', [[], [[1.]], [[1.], []], [[1.], [2.], [3.]]])
def test_embedding_mismatch_prevents_index_mutation(monkeypatch, embeddings):
    monkeypatch.setattr(rag_pipeline, 'extract_pages_from_pdf', lambda _: (['text'], {}))
    monkeypatch.setattr(rag_pipeline, 'chunk_pages', lambda _: [{'text':'one'}, {'text':'two'}])
    monkeypatch.setattr(rag_pipeline, 'get_embeddings_cohere', lambda _: embeddings)
    monkeypatch.setattr(rag_pipeline, '_get_index', lambda: pytest.fail('must not touch index'))
    with pytest.raises(RuntimeError, match='embedding'):
        rag_pipeline.ingest_revision('unused.pdf', 'doc', 2)


@pytest.mark.parametrize('interval', ['0', '-1', 'nan', 'inf'])
def test_invalid_interval_never_creates_client(monkeypatch, interval):
    monkeypatch.setattr(sys, 'argv', ['worker', '--interval', interval])
    monkeypatch.setattr(ingestion_worker, 'get_supabase', lambda **_: pytest.fail('must not create client'))
    with pytest.raises(SystemExit) as exc:
        ingestion_worker.main()
    assert exc.value.code == 2


def test_stop_interrupts_idle_wait(monkeypatch):
    monkeypatch.setattr(ingestion_worker, '_running', True)
    ingestion_worker._shutdown.clear()
    try:
        ingestion_worker._stop(None, None)
        assert not ingestion_worker._running
        assert ingestion_worker._shutdown.wait(0)
    finally:
        ingestion_worker._shutdown.clear()

@pytest.mark.parametrize('count', [None, 1, 3])
def test_exact_index_count_required(monkeypatch, count):
    from types import SimpleNamespace
    chunk={'text':'text','page_start':1,'page_end':1,'section_title':'title'}
    monkeypatch.setattr(rag_pipeline, 'extract_pages_from_pdf', lambda _: (['text'], {}))
    monkeypatch.setattr(rag_pipeline, 'chunk_pages', lambda _: [dict(chunk), dict(chunk)])
    monkeypatch.setattr(rag_pipeline, 'get_embeddings_cohere', lambda _: [[1.], [2.]])
    index=SimpleNamespace(delete=lambda **_: None, upsert=lambda **_: None, describe_index_stats=lambda: {'namespaces':{'doc:doc:rev:2':{'vector_count':count}}})
    monkeypatch.setattr(rag_pipeline, '_get_index', lambda: index)
    with pytest.raises(RuntimeError, match='verification'):
        rag_pipeline.ingest_revision('unused.pdf','doc',2)


def test_provider_timeout_does_not_touch_index(monkeypatch):
    monkeypatch.setattr(rag_pipeline, 'extract_pages_from_pdf', lambda _: (['text'], {}))
    monkeypatch.setattr(rag_pipeline, 'chunk_pages', lambda _: [{'text':'one'}])
    def timeout(_):
        raise TimeoutError('test timeout')
    monkeypatch.setattr(rag_pipeline, 'get_embeddings_cohere', timeout)
    monkeypatch.setattr(rag_pipeline, '_get_index', lambda: pytest.fail('must not touch index'))
    with pytest.raises(TimeoutError):
        rag_pipeline.ingest_revision('unused.pdf','doc',2)


def test_retry_does_not_overwrite_concurrent_claim(monkeypatch):
    from tests.test_ingestion import ACTOR
    db = base_db()
    seed_job(db, status='failed', attempts=1)
    original = service._update
    def claimed(client, table, filters, payload):
        db.tables[service.JOBS_TABLE][0].update(status='running', worker_id='new-worker', attempts=2)
        return original(client, table, filters, payload)
    monkeypatch.setattr(service, '_update', claimed)
    with pytest.raises(service.IngestionConflict, match='changed'):
        service.retry_job(db, ACTOR, 'job-1')
    assert db.tables[service.JOBS_TABLE][0]['status'] == 'running'
    assert db.tables[service.JOBS_TABLE][0]['worker_id'] == 'new-worker'
