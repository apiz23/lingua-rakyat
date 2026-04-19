insert into public.lr_documents (
  id,
  name,
  size_bytes,
  chunk_count,
  status,
  uploaded_at,
  storage_path,
  public_url,
  error_message
)
values
  (
    '391a88ff-42c9-42a6-829e-a16d2fd256cd',
    'Data Sharing Act 2025 (Act 864).pdf',
    334495,
    0,
    'ready',
    '2026-03-25T16:37:29.027958'::timestamptz,
    '391a88ff-42c9-42a6-829e-a16d2fd256cd/Data Sharing Act 2025 (Act 864).pdf',
    'https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/documents/391a88ff-42c9-42a6-829e-a16d2fd256cd/Data%20Sharing%20Act%202025%20(Act%20864).pdf',
    null
  ),
  (
    '5adb6580-6439-4894-b832-d9fee3f84e78',
    'FAQ SUMBANGAN ASAS RAHMAH (SARA) 2026.pdf',
    308389,
    0,
    'ready',
    '2026-03-25T13:04:08.507526'::timestamptz,
    '5adb6580-6439-4894-b832-d9fee3f84e78/FAQ SUMBANGAN ASAS RAHMAH (SARA) 2026.pdf',
    'https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/documents/5adb6580-6439-4894-b832-d9fee3f84e78/FAQ%20SUMBANGAN%20ASAS%20RAHMAH%20(SARA)%202026.pdf',
    null
  ),
  (
    '2134cd96-22f2-4b23-8cae-73ffc9c2b5d8',
    'FAQ PERMOHONAN STR 2026.pdf',
    155874,
    0,
    'ready',
    '2026-03-26T11:28:57.399621'::timestamptz,
    '2134cd96-22f2-4b23-8cae-73ffc9c2b5d8/FAQ PERMOHONAN STR 2026.pdf',
    'https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/documents/2134cd96-22f2-4b23-8cae-73ffc9c2b5d8/FAQ%20PERMOHONAN%20STR%202026.pdf',
    null
  ),
  (
    'bf7c6e69-ec74-4701-8e65-f80ccd70a659',
    'Lingua-Rakyat-Brief.pdf',
    243448,
    0,
    'ready',
    '2026-03-26T21:21:37.262643'::timestamptz,
    'bf7c6e69-ec74-4701-8e65-f80ccd70a659/Lingua-Rakyat-Brief.pdf',
    'https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/documents/bf7c6e69-ec74-4701-8e65-f80ccd70a659/Lingua-Rakyat-Brief.pdf',
    null
  ),
  (
    'ef48e020-e498-4ae3-ab72-d98fcbf66c19',
    'Bachelor-Resume-Hafizuddin.pdf',
    128907,
    0,
    'ready',
    '2026-04-05T19:15:57.497615'::timestamptz,
    'ef48e020-e498-4ae3-ab72-d98fcbf66c19/Bachelor-Resume-Hafizuddin.pdf',
    'https://otmlfmgyscrohtbpqqoi.supabase.co/storage/v1/object/public/documents/ef48e020-e498-4ae3-ab72-d98fcbf66c19/Bachelor-Resume-Hafizuddin.pdf',
    null
  )
on conflict (id) do update set
  name = excluded.name,
  size_bytes = excluded.size_bytes,
  chunk_count = excluded.chunk_count,
  status = excluded.status,
  uploaded_at = excluded.uploaded_at,
  storage_path = excluded.storage_path,
  public_url = excluded.public_url,
  error_message = excluded.error_message;
