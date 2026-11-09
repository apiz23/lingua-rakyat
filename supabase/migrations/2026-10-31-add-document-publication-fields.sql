-- Add explicit, deny-by-default publication metadata to the document catalogue.
-- Existing documents remain unclassified/draft. Processing status is unchanged.
-- This migration targets the checked-in public.lr_documents table; deployments
-- using DOCUMENTS_TABLE must reconcile that configuration before applying it.

ALTER TABLE public.lr_documents
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS owner_type text,
  ADD COLUMN IF NOT EXISTS owner_id text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS document_version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_visibility_scope_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_visibility_scope_check
      CHECK (visibility_scope in ('unclassified', 'private', 'public'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_publication_status_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_publication_status_check
      CHECK (publication_status in ('draft', 'review', 'approved', 'published', 'suspended', 'expired', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_document_version_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_document_version_check
      CHECK (document_version > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_telegram_owner_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_telegram_owner_check
      CHECK (owner_type is distinct from 'telegram_chat' or nullif(trim(owner_id), '') is not null);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_approval_metadata_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_approval_metadata_check
      CHECK (
        publication_status not in ('approved', 'published')
        or (
          nullif(trim(approved_by), '') is not null
          and approved_at is not null
          and nullif(trim(source_id), '') is not null
          and nullif(trim(source_type), '') is not null
          and last_verified_at is not null
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lr_documents'::regclass
      AND conname = 'lr_documents_published_scope_check'
  ) THEN
    ALTER TABLE public.lr_documents
      ADD CONSTRAINT lr_documents_published_scope_check
      CHECK (
        publication_status <> 'published'
        or (visibility_scope = 'public' and published_at is not null)
      );
  END IF;
END $$;
