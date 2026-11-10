



ALTER TABLE lr_documents ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE lr_documents ADD COLUMN IF NOT EXISTS agency varchar(20);


ALTER TABLE lr_eval_records ADD COLUMN IF NOT EXISTS faithfulness_score float;
