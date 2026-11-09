-- Keep document approval and current-revision review state in one transaction.
-- Publication eligibility requires both records to agree.

create or replace function public.review_current_document_revision(
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
  v_revision integer;
  v_review jsonb;
  v_actor_role text;
  v_state text;
  v_now timestamptz := now();
begin
  if p_action not in ('approve', 'reject', 'request_changes') then
    raise exception 'invalid_review_action' using errcode = 'P0001';
  end if;
  if nullif(trim(p_actor), '') is null then
    raise exception 'review_actor_required' using errcode = 'P0001';
  end if;
  if p_action in ('reject', 'request_changes') and nullif(trim(p_reason), '') is null then
    raise exception 'review_reason_required' using errcode = 'P0001';
  end if;

  select * into v_doc
    from public.lr_documents
    where id = p_document_id
    for update;
  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;
  if v_doc.publication_status = 'published' then
    raise exception 'document_already_published' using errcode = 'P0001';
  end if;

  v_revision := coalesce(v_doc.current_revision, v_doc.document_version, 1);
  if p_revision is distinct from v_revision then
    raise exception 'revision_not_current' using errcode = 'P0001';
  end if;
  if p_action = 'approve' and v_doc.status <> 'ready' then
    raise exception 'processing_not_ready' using errcode = 'P0001';
  end if;

  select * into v_rev
    from public.document_revisions
    where document_id = p_document_id and revision = v_revision
    for update;
  if not found then
    if p_action = 'approve' then
      raise exception 'revision_not_found' using errcode = 'P0002';
    end if;

    update public.lr_documents
      set publication_status = 'draft', approved_by = null, approved_at = null
      where id = p_document_id;
    v_state := case when p_action = 'reject' then 'rejected' else 'changes_requested' end;
    select coalesce(string_agg(role, ','), '') into v_actor_role
      from public.admin_roles where actor_id = p_actor and revoked_at is null;
    insert into public.admin_audit_log
      (actor_id, actor_role, action, target_type, target_id, reason,
       state_from, state_to, correlation_id, details, created_at)
    values
      (p_actor, nullif(v_actor_role, ''), 'review.' || p_action, 'document',
       p_document_id, p_reason, v_doc.publication_status, 'draft',
       gen_random_uuid()::text,
       jsonb_build_object('revision', v_revision, 'revision_record_missing', true), v_now);

    return jsonb_build_object(
      'document_id', p_document_id,
      'revision', v_revision,
      'review_status', v_state,
      'publication_status', 'draft'
    );
  end if;

  v_review := public.review_document_revision(
    p_document_id, v_revision, p_action, p_actor, p_reason
  );

  if p_action = 'approve' then
    select * into v_source
      from public.official_sources
      where source_id = v_rev.source_id;
    if not found
       or v_source.verification_status <> 'verified'
       or v_source.usage_permitted is not true
       or v_source.revoked_at is not null
       or nullif(trim(v_source.usage_rights), '') is null
       or v_source.freshness_days is null
       or v_source.freshness_days <= 0
       or v_source.freshness_days > 3650
       or v_source.last_verified_at is null
       or v_now - v_source.last_verified_at > make_interval(days => v_source.freshness_days) then
      raise exception 'source_not_verified' using errcode = 'P0001';
    end if;
    update public.lr_documents
      set publication_status = 'approved',
          visibility_scope = 'private',
          approved_by = p_actor,
          approved_at = v_now,
          last_verified_at = v_source.last_verified_at,
          source_id = v_rev.source_id,
          source_type = v_rev.source_type
      where id = p_document_id;
    v_state := 'approved';
  else
    update public.lr_documents
      set publication_status = 'draft', approved_by = null, approved_at = null
      where id = p_document_id;
    v_state := 'draft';
  end if;

  select coalesce(string_agg(role, ','), '') into v_actor_role
    from public.admin_roles where actor_id = p_actor and revoked_at is null;
  insert into public.admin_audit_log
    (actor_id, actor_role, action, target_type, target_id, reason,
     state_from, state_to, correlation_id, details, created_at)
  values
    (p_actor, nullif(v_actor_role, ''), 'review.' || p_action, 'document',
     p_document_id, p_reason, v_doc.publication_status, v_state,
     gen_random_uuid()::text,
     jsonb_build_object('revision', v_revision), v_now);

  return v_review || jsonb_build_object(
    'publication_status', v_state,
    'current_revision', v_revision
  );
end;
$$;

revoke all on function public.review_current_document_revision(text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_current_document_revision(text, integer, text, text, text)
  to service_role;
