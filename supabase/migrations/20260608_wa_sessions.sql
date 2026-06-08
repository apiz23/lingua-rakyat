create table if not exists lr_wa_sessions (
  phone        text primary key,
  document_id  text,
  doc_name     text default '',
  session_id   text default '',
  history      jsonb default '[]'::jsonb,
  updated_at   timestamptz default now()
);
