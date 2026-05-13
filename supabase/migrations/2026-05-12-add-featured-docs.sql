-- supabase/migrations/2026-05-12-add-featured-docs.sql
-- Adds featured document support and faithfulness scoring

-- Featured docs columns (for pre-loaded government documents)
ALTER TABLE lr_documents ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE lr_documents ADD COLUMN IF NOT EXISTS agency varchar(20);

-- Faithfulness score column for live query eval records
ALTER TABLE lr_eval_records ADD COLUMN IF NOT EXISTS faithfulness_score float;
