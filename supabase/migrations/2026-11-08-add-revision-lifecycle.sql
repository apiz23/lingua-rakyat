-- Revision lifecycle, revision-scoped indexing and worker leases (2026-11-08).
-- Additive only.

ALTER TABLE public.document_revisions
  ADD COLUMN IF NOT EXISTS indexing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS index_namespace text,
  ADD COLUMN IF NOT EXISTS index_error text,
  ADD COLUMN IF NOT EXISTS verification_chunk_ids text[],
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.document_revisions'::regclass
      AND conname = 'document_revisions_indexing_status_check'
  ) THEN
    ALTER TABLE public.document_revisions
      ADD CONSTRAINT document_revisions_indexing_status_check
      CHECK (indexing_status IN ('pending', 'indexing', 'indexed', 'failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.document_revisions'::regclass
      AND conname = 'document_revisions_review_status_check'
  ) THEN
    ALTER TABLE public.document_revisions
      ADD CONSTRAINT document_revisions_review_status_check
      CHECK (review_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.document_revisions'::regclass
      AND conname = 'document_revisions_chunk_count_check'
  ) THEN
    ALTER TABLE public.document_revisions
      ADD CONSTRAINT document_revisions_chunk_count_check CHECK (chunk_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS document_revisions_review_status_idx
  ON public.document_revisions (review_status, indexing_status);

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ingestion_jobs_claim_idx
  ON public.ingestion_jobs (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS ingestion_jobs_lease_idx
  ON public.ingestion_jobs (status, lease_expires_at);
