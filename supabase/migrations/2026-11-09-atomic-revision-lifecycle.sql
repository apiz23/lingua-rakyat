-- Atomic revision review / promotion / rollback (2026-11-09).
--
-- All lifecycle state changes and their events/audit rows happen inside one
-- PostgreSQL transaction. The function returns the new current revision or
-- raises, so callers can never persist a partial lifecycle transition.

create or replace function public.review_document_revision(
  p_document_id text,
  p_revision integer,
  p_action text,
  p_actor text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.lr_documents%rowtype;
  v_rev public.document_revisions%rowtype;
  v_source public.official_sources%rowtype;
  v_now timestamptz := now();
  v_status text;
  v_actor_role text;
begin
  if p_action not in ('approve', 'reject', 'request_changes') then
    raise exception 'invalid_review_action' using errcode = 'P0001';
  end if;
  select * into v_doc from public.lr_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  select * into v_rev from public.document_revisions
    where document_id = p_document_id and revision = p_revision for update;
  if not found then
    raise exception 'revision_not_found' using errcode = 'P0002';
  end if;
  if v_rev.revoked_at is not null then
    raise exception 'revision_revoked' using errcode = 'P0001';
  end if;

  if p_action = 'approve' then
    if v_rev.review_status = 'approved' then
      raise exception 'revision_already_approved' using errcode = 'P0001';
    end if;
    if v_rev.indexing_status <> 'indexed' or coalesce(v_rev.chunk_count, 0) <= 0
       or coalesce(v_rev.index_namespace, '') = '' then
      raise exception 'revision_not_indexed' using errcode = 'P0001';
    end if;
    if coalesce((v_rev.metadata->>'extraction_status'), '') in ('failed', 'ocr_required') then
      raise exception 'revision_extraction_not_reviewable' using errcode = 'P0001';
    end if;
    select * into v_source from public.official_sources where source_id = v_rev.source_id;
    if not found or v_source.verification_status <> 'verified'
       or v_source.usage_permitted is not true or v_source.revoked_at is not null then
      raise exception 'source_not_verified' using errcode = 'P0001';
    end if;
    if v_source.freshness_days is null or v_source.last_verified_at is null
       or v_now - v_source.last_verified_at > make_interval(days => v_source.freshness_days) then
      raise exception 'source_stale' using errcode = 'P0001';
    end if;
    if v_doc.expires_at is not null and v_doc.expires_at <= v_now then
      raise exception 'document_expired' using errcode = 'P0001';
    end if;
    update public.document_revisions
      set approved_by = p_actor, approved_at = v_now,
          review_status = 'approved', reviewed_by = p_actor,
          reviewed_at = v_now, review_reason = p_reason
      where document_id = p_document_id and revision = p_revision;
    insert into public.publication_events
      (document_id, revision, event_type, actor, occurred_at, idempotency_key, details)
    values
      (p_document_id, p_revision, 'approval', p_actor, v_now,
       'revision-approval:' || p_document_id || ':' || p_revision || ':' || gen_random_uuid(),
       jsonb_build_object('reason', p_reason));
    v_status := 'approved';
  else
    update public.document_revisions
      set approved_by = null, approved_at = null,
          review_status = case when p_action = 'reject' then 'rejected' else 'changes_requested' end,
          reviewed_by = p_actor, reviewed_at = v_now, review_reason = p_reason
      where document_id = p_document_id and revision = p_revision;
    v_status := case when p_action = 'reject' then 'rejected' else 'changes_requested' end;
  end if;

  select coalesce(string_agg(role, ','), '') into v_actor_role
    from public.lr_admin_roles where email = p_actor and revoked_at is null;

  insert into public.admin_audit_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     state_from, state_to, correlation_id, details, created_at)
  values
    (p_actor, nullif(v_actor_role, ''), 'revision.' || p_action, 'document_revision',
     p_document_id || ':' || p_revision, p_reason,
     coalesce(v_rev.review_status, 'pending'), v_status,
     gen_random_uuid()::text, '{}'::jsonb, v_now);

  return jsonb_build_object(
    'document_id', p_document_id,
    'revision', p_revision,
    'review_status', v_status,
    'current_revision', v_doc.current_revision
  );
end;
$$;

create or replace function public.promote_document_revision(
  p_document_id text,
  p_revision integer,
  p_expected_current integer,
  p_actor text,
  p_action text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.lr_documents%rowtype;
  v_target public.document_revisions%rowtype;
  v_source public.official_sources%rowtype;
  v_now timestamptz := now();
  v_actor_role text;
begin
  if p_action not in ('promote', 'rollback') then
    raise exception 'invalid_lifecycle_action' using errcode = 'P0001';
  end if;
  select * into v_doc from public.lr_documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_doc.publication_status <> 'published' then
    raise exception 'document_not_published' using errcode = 'P0001';
  end if;
  if v_doc.current_revision is distinct from p_expected_current then
    raise exception 'concurrent_modification' using errcode = '40001';
  end if;
  select * into v_target from public.document_revisions
    where document_id = p_document_id and revision = p_revision for update;
  if not found then
    raise exception 'revision_not_found' using errcode = 'P0002';
  end if;
  if v_target.review_status <> 'approved' or coalesce(v_target.approved_by, '') = '' then
    raise exception 'revision_not_approved' using errcode = 'P0001';
  end if;
  if v_target.indexing_status <> 'indexed' or coalesce(v_target.chunk_count, 0) <= 0
     or coalesce(v_target.index_namespace, '') = '' then
    raise exception 'revision_not_indexed' using errcode = 'P0001';
  end if;
  if v_target.revoked_at is not null then
    raise exception 'revision_revoked' using errcode = 'P0001';
  end if;
  if p_action = 'promote' and p_revision <= v_doc.current_revision then
    raise exception 'promotion_target_not_newer' using errcode = 'P0001';
  end if;
  if p_action = 'rollback' and p_revision >= v_doc.current_revision then
    raise exception 'rollback_target_not_older' using errcode = 'P0001';
  end if;

  select * into v_source from public.official_sources where source_id = v_target.source_id;
  if not found or v_source.verification_status <> 'verified'
     or v_source.usage_permitted is not true or v_source.revoked_at is not null then
    raise exception 'source_not_verified' using errcode = 'P0001';
  end if;
  if v_source.freshness_days is null or v_source.last_verified_at is null
     or v_now - v_source.last_verified_at > make_interval(days => v_source.freshness_days) then
    raise exception 'source_stale' using errcode = 'P0001';
  end if;
  if v_doc.expires_at is not null and v_doc.expires_at <= v_now then
    raise exception 'document_expired' using errcode = 'P0001';
  end if;

  update public.lr_documents
    set current_revision = p_revision,
        document_version = p_revision,
        checksum = v_target.checksum,
        source_id = v_target.source_id,
        source_type = v_target.source_type,
        page_count = coalesce((v_target.metadata->>'page_count')::integer, page_count),
        extraction_status = coalesce(v_target.metadata->>'extraction_status', extraction_status),
        ocr_required = false
    where id = p_document_id and current_revision = p_expected_current;
  if not found then
    raise exception 'concurrent_modification' using errcode = '40001';
  end if;

  update public.document_revisions
    set superseded_at = case when revision = p_expected_current then v_now else superseded_at end
    where document_id = p_document_id and revision = p_expected_current and p_expected_current <> p_revision;
  update public.document_revisions set superseded_at = null
    where document_id = p_document_id and revision = p_revision;

  insert into public.publication_events
    (document_id, revision, event_type, actor, occurred_at, idempotency_key, details)
  values
    (p_document_id, p_revision, 'publication', p_actor, v_now,
     'revision-' || p_action || ':' || p_document_id || ':' || p_revision || ':' || gen_random_uuid(),
     jsonb_build_object('action', p_action, 'previous_revision', p_expected_current, 'reason', p_reason));

  select coalesce(string_agg(role, ','), '') into v_actor_role
    from public.lr_admin_roles where email = p_actor and revoked_at is null;

  insert into public.admin_audit_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     state_from, state_to, correlation_id, details, created_at)
  values
    (p_actor, nullif(v_actor_role, ''), 'revision.' || p_action, 'document_revision',
     p_document_id || ':' || p_revision, p_reason,
     'current:' || p_expected_current, 'current:' || p_revision,
     gen_random_uuid()::text,
     jsonb_build_object('previous_revision', p_expected_current), v_now);

  return jsonb_build_object(
    'document_id', p_document_id,
    'revision', p_revision,
    'previous_revision', p_expected_current,
    'current_revision', p_revision,
    'action', p_action
  );
end;
$$;

revoke all on function public.review_document_revision(text, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.promote_document_revision(text, integer, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.review_document_revision(text, integer, text, text, text) to service_role;
grant execute on function public.promote_document_revision(text, integer, integer, text, text, text) to service_role;
