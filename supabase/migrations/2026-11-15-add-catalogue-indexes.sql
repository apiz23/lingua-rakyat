-- Catalogue read path now filters revisions and sources server-side with
-- `.in_(document_id, …)` / `.in_(source_id, …)`. The revision filter needs a
-- composite index to stay fast as revision history grows.
--
-- Review before applying; this migration is not run by the application.

CREATE INDEX IF NOT EXISTS document_revisions_document_revision_idx
  ON public.document_revisions (document_id, revision);

NOTIFY pgrst, 'reload schema';
