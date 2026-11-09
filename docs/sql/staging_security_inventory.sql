-- Lingua Rakyat: read-only Supabase staging security inventory
--
-- Run only in an explicitly authorized STAGING project, using a read-only
-- database role. These statements inspect PostgreSQL/Supabase metadata only.
-- They do not inspect application rows, document contents, secrets, or tokens.
-- Do not run against production. Do not run migrations or change grants/policies.
--
-- Some metadata views may be unavailable to the selected read-only role. A
-- permission error means UNKNOWN/INACCESSIBLE, not “no policy” or “no grants”.
-- Record each statement's result or access error separately.

-- 1. Relations (tables, partitioned tables, views, materialized views,
--    sequences) and their schemas. Includes Supabase Storage metadata objects.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'p' THEN 'partitioned_table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized_view'
         WHEN 'S' THEN 'sequence'
         WHEN 'f' THEN 'foreign_table'
         ELSE c.relkind::text
       END AS object_type,
       c.relpersistence AS persistence
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, object_type, c.relname;

-- 2. Column names and database types only. No row values are read.
SELECT table_schema,
       table_name,
       ordinal_position,
       column_name,
       data_type,
       udt_name,
       is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;

-- 3. RLS enablement and FORCE RLS status for tables/partitioned tables.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

-- 4. Policy metadata and predicates. Policies should not contain credentials
--    or bearer tokens. If an unexpected literal looks sensitive, do not copy
--    that value into an audit artifact; redact it before sharing results.
SELECT schemaname AS schema_name,
       tablename AS table_name,
       policyname AS policy_name,
       roles,
       cmd AS command,
       qual AS using_expression,
       with_check AS check_expression
FROM pg_catalog.pg_policies
ORDER BY schemaname, tablename, policyname;

-- 5. Table/view ACL grants, including grants to PUBLIC and default ACLs.
--    This reports metadata only; it does not enumerate table data.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.grantor::regrole::text AS grantor,
       acl.privilege_type,
       acl.is_grantable
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = c.relowner
CROSS JOIN LATERAL pg_catalog.aclexplode(
  COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname, grantee, acl.privilege_type;

-- 6. Schema privileges. Explicit ACLs are expanded; default ACLs apply when
--    the schema has no explicit ACL. PUBLIC is shown as a grantee if present.
SELECT n.nspname AS schema_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.grantor::regrole::text AS grantor,
       acl.privilege_type,
       acl.is_grantable
FROM pg_catalog.pg_namespace AS n
JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = n.nspowner
CROSS JOIN LATERAL pg_catalog.aclexplode(
  COALESCE(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, grantee, acl.privilege_type;

-- 7. Sequence privileges. Sequence names and grants only; no sequence values.
SELECT n.nspname AS schema_name,
       c.relname AS sequence_name,
       r.rolname AS role_name,
       pg_catalog.has_sequence_privilege(r.oid, c.oid, 'USAGE') AS can_use,
       pg_catalog.has_sequence_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       pg_catalog.has_sequence_privilege(r.oid, c.oid, 'UPDATE') AS can_update
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN pg_catalog.pg_roles AS r
WHERE c.relkind = 'S'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname, r.rolname;

-- 8. Function/procedure EXECUTE ACLs and signatures only. Function bodies are
--    deliberately not selected. PUBLIC is included when granted.
SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.grantor::regrole::text AS grantor,
       acl.privilege_type,
       acl.is_grantable
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = p.proowner
CROSS JOIN LATERAL pg_catalog.aclexplode(
  COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname, identity_arguments, grantee;

-- 9. Default privileges that affect future objects. No role credentials or
--    function bodies are exposed.
SELECT owner_role.rolname AS object_creator_role,
       COALESCE(n.nspname, '(all schemas)') AS schema_name,
       d.defaclobjtype AS object_type_code,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.grantor::regrole::text AS grantor,
       acl.privilege_type,
       acl.is_grantable
FROM pg_catalog.pg_default_acl AS d
JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = d.defaclrole
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
ORDER BY owner_role.rolname, schema_name, object_type_code, grantee,
         acl.privilege_type;

-- 10. Supabase Storage bucket metadata only. If storage.buckets is unavailable
--     to this role, record “metadata inaccessible” and request approved access.
SELECT id AS bucket_id,
       name AS bucket_name,
       public AS is_public,
       file_size_limit,
       allowed_mime_types
FROM storage.buckets
ORDER BY id;

-- 11. Storage object policies. This reads policy metadata, not object rows.
--     The policy expression caution in query 4 applies here as well.
SELECT schemaname AS schema_name,
       tablename AS table_name,
       policyname AS policy_name,
       roles,
       cmd AS command,
       qual AS using_expression,
       with_check AS check_expression
FROM pg_catalog.pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- 12. Relevant ownership columns and indexes. Column names/definitions only;
--     no owner values or citizen rows are selected.
SELECT table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND column_name IN (
    'user_id', 'owner_id', 'tenant_id', 'organization_id', 'org_id',
    'session_id', 'chat_id', 'phone'
  )
ORDER BY table_schema, table_name, column_name;

SELECT schemaname AS schema_name,
       tablename AS table_name,
       indexname AS index_name,
       indexdef AS index_definition
FROM pg_catalog.pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND indexdef ~* '(user_id|owner_id|tenant_id|organization_id|org_id|session_id|chat_id|phone)'
ORDER BY schemaname, tablename, indexname;

-- 13. Presence-only check for the share owner column and ownership indexes.
--     An empty result means absent from metadata visible to this role only if
--     the query succeeded; permission errors mean unknown.
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'lr_shared_answers'
    AND column_name = 'user_id'
) AS lr_shared_answers_user_id_column_visible;

SELECT indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'lr_shared_answers'
  AND indexdef ~* '\muser_id\M'
ORDER BY indexname;
