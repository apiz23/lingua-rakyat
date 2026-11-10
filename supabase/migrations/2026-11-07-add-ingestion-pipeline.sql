





ALTER TABLE public.lr_documents
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS publication_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS ocr_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_extraction_status_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_extraction_status_check
      CHECK (extraction_status IN ('pending', 'processing', 'complete', 'ocr_required', 'failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_page_count_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_page_count_check CHECK (page_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lr_documents_source_url_idx
  ON public.lr_documents (source_id, source_url);

CREATE INDEX IF NOT EXISTS lr_documents_checksum_idx
  ON public.lr_documents (checksum);


CREATE TABLE IF NOT EXISTS public.ingestion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  external_id text,
  source_url text NOT NULL,
  canonical_url text NOT NULL,
  title text,
  issuing_organization text,
  document_type text,
  language text,
  file_format text NOT NULL DEFAULT 'pdf',
  publication_date timestamptz,
  last_updated_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  discovery_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'discovered',
  duplicate_class text,
  checksum text,
  document_id text,
  revision integer,
  extraction_status text,
  ocr_required boolean NOT NULL DEFAULT false,
  page_count integer NOT NULL DEFAULT 0,
  skip_reason text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_candidates_status_check
    CHECK (status IN ('discovered', 'queued', 'ingesting', 'ingested', 'unchanged',
                      'duplicate_review', 'ocr_required', 'skipped', 'failed')),
  CONSTRAINT ingestion_candidates_format_check
    CHECK (file_format IN ('pdf')),
  CONSTRAINT ingestion_candidates_url_check
    CHECK (nullif(trim(source_url), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ingestion_candidates_source_url_unique
  ON public.ingestion_candidates (source_id, canonical_url);

CREATE INDEX IF NOT EXISTS ingestion_candidates_status_idx
  ON public.ingestion_candidates (status, discovered_at DESC);


CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  source_id text,
  candidate_id uuid REFERENCES public.ingestion_candidates(id) ON DELETE CASCADE,
  document_id text,
  status text NOT NULL DEFAULT 'queued',
  stage text,
  progress integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  correlation_id text,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_jobs_type_check
    CHECK (job_type IN ('discovery', 'ingest')),
  CONSTRAINT ingestion_jobs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT ingestion_jobs_progress_check CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT ingestion_jobs_attempts_check
    CHECK (attempts >= 0 AND max_attempts >= 1 AND attempts <= max_attempts)
);


CREATE UNIQUE INDEX IF NOT EXISTS ingestion_jobs_active_candidate_unique
  ON public.ingestion_jobs (candidate_id)
  WHERE candidate_id IS NOT NULL AND status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS ingestion_jobs_status_idx
  ON public.ingestion_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS ingestion_jobs_source_idx
  ON public.ingestion_jobs (source_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.source_discovery_checkpoints (
  source_id text PRIMARY KEY,
  last_discovered_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  etag text,
  last_modified text,
  cursor text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_discovery_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ingestion_candidates FROM anon, authenticated;
REVOKE ALL ON TABLE public.ingestion_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.source_discovery_checkpoints FROM anon, authenticated;
