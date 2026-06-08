create table if not exists lr_tg_sessions (
  chat_id      text primary key,
  document_id  text,
  doc_name     text default '',
  session_id   text default '',
  history      jsonb default '[]'::jsonb,
  doc_map      jsonb default '{}'::jsonb,
  updated_at   timestamptz default now()
);
