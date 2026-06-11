alter table public.lr_chat_messages
  add column if not exists faithfulness double precision;
