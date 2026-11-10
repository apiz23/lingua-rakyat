import { z } from "zod"

export const DashboardMetricsSchema = z.object({
  total_documents: z.number(),
  awaiting_review: z.number(),
  published: z.number(),
  approved: z.number(),
  rejected: z.number(),
  suspended: z.number(),
  withdrawn: z.number(),
  expiring: z.number(),
  expired: z.number(),
  unverified_sources: z.number(),
  failed_ingestion: z.number(),
})

export const AuditEntrySchema = z.object({
  id: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  actor_id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  actor_role: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  action: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  target_type: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  target_id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  reason: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  state_from: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  state_to: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  correlation_id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  details: z.record(z.string(), z.unknown()).optional(),
  created_at: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
})

export const DashboardResponseSchema = z.object({
  generated_at: z.string(),
  metrics: DashboardMetricsSchema,
  recent_activity: z.array(AuditEntrySchema),
})

export const PaginatedSchema = <T extends z.ZodType>(tSchema: T) =>
  z.object({
    items: z.array(tSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
  })

export const AdminSourceSchema = z.object({
  source_id: z.string(),
  issuing_organization: z.string(),
  authority: z.union([z.string(), z.null()]).optional(),
  source_url: z.union([z.string(), z.null()]).optional(),
  source_type: z.string(),
  verification_status: z.string(),
  verified_by: z.union([z.string(), z.null()]).optional(),
  verified_at: z.union([z.string(), z.null()]).optional(),
  usage_rights: z.union([z.string(), z.null()]).optional(),
  usage_permitted: z.boolean(),
  freshness_days: z.union([z.number(), z.null()]).optional(),
  last_verified_at: z.union([z.string(), z.null()]).optional(),
  revoked_at: z.union([z.string(), z.null()]).optional(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.union([z.string(), z.null()]).optional(),
  updated_at: z.union([z.string(), z.null()]).optional(),
})

export const AdminRevisionSchema = z.object({
  revision: z.number(),
  source_id: z.union([z.string(), z.null()]).optional(),
  source_type: z.union([z.string(), z.null()]).optional(),
  checksum: z.union([z.string(), z.null()]).optional(),
  approved_by: z.union([z.string(), z.null()]).optional(),
  approved_at: z.union([z.string(), z.null()]).optional(),
  created_at: z.union([z.string(), z.null()]).optional(),
  superseded_at: z.union([z.string(), z.null()]).optional(),
  revoked_at: z.union([z.string(), z.null()]).optional(),
  has_storage: z.boolean(),
  is_current: z.boolean(),
  indexing_status: z.string().optional(),
  indexed_at: z.union([z.string(), z.null()]).optional(),
  chunk_count: z.number().optional(),
  index_error: z.union([z.string(), z.null()]).optional(),
  review_status: z.string().optional(),
  review_reason: z.union([z.string(), z.null()]).optional(),
  reviewed_by: z.union([z.string(), z.null()]).optional(),
  reviewed_at: z.union([z.string(), z.null()]).optional(),
})

export const PublicationEventSchema = z.object({
  id: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  event_type: z.string(),
  actor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  occurred_at: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const AdminDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size_bytes: z.number(),
  chunk_count: z.number(),
  status: z.union([
    z.literal("processing"),
    z.literal("ready"),
    z.literal("error"),
    z.string(),
  ]),
  uploaded_at: z.string(),
  agency: z.union([z.string(), z.null()]).optional(),
  is_featured: z.boolean(),
  visibility_scope: z.string(),
  publication_status: z.string(),
  source_id: z.union([z.string(), z.null()]).optional(),
  source_type: z.union([z.string(), z.null()]).optional(),
  owner_type: z.union([z.string(), z.null()]).optional(),
  approved_by: z.union([z.string(), z.null()]).optional(),
  approved_at: z.union([z.string(), z.null()]).optional(),
  published_at: z.union([z.string(), z.null()]).optional(),
  expires_at: z.union([z.string(), z.null()]).optional(),
  last_verified_at: z.union([z.string(), z.null()]).optional(),
  current_revision: z.number(),
  error_message: z.union([z.string(), z.null()]).optional(),
  has_storage: z.boolean(),
  source: z.union([AdminSourceSchema, z.null()]).optional(),
  revision: z.union([AdminRevisionSchema, z.null()]).optional(),
  revisions: z.array(AdminRevisionSchema).optional(),
  events: z.array(PublicationEventSchema).optional(),
  blockers: z.array(z.string()).optional(),
})

export const RoleAssignmentSchema = z.object({
  id: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  actor_id: z.string(),
  role: z.string(),
  granted_by: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  granted_at: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  revoked_at: z.union([z.string(), z.null()]).optional(),
  revoked_by: z.union([z.string(), z.null()]).optional(),
  reason: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
})

export const IngestionOverviewSchema = z.object({
  generated_at: z.string(),
  candidates: z.record(z.string(), z.number()),
  jobs: z.record(z.string(), z.number()),
  documents: z.object({
    awaiting_review: z.number(),
    ocr_required: z.number(),
    failed_processing: z.number(),
  }),
  sources: z.array(
    z.object({
      source_id: z.string(),
      issuing_organization: z.string(),
      source_type: z.string(),
      verification_status: z.string(),
      last_discovered_at: z.union([z.string(), z.null()]).optional(),
      last_error: z.union([z.string(), z.null()]).optional(),
    })
  ),
})

export const IngestionJobSchema = z.object({
  id: z.string(),
  job_type: z.union([z.literal("discovery"), z.literal("ingest")]),
  source_id: z.union([z.string(), z.null()]).optional(),
  candidate_id: z.union([z.string(), z.null()]).optional(),
  document_id: z.union([z.string(), z.null()]).optional(),
  status: z.string(),
  stage: z.union([z.string(), z.null()]).optional(),
  progress: z.number(),
  attempts: z.number(),
  max_attempts: z.number(),
  error_message: z.union([z.string(), z.null()]).optional(),
  details: z.record(z.string(), z.unknown()),
  created_at: z.union([z.string(), z.null()]).optional(),
  started_at: z.union([z.string(), z.null()]).optional(),
  finished_at: z.union([z.string(), z.null()]).optional(),
})

export const IngestionCandidateSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  external_id: z.union([z.string(), z.null()]).optional(),
  source_url: z.string(),
  canonical_url: z.string(),
  title: z.union([z.string(), z.null()]).optional(),
  issuing_organization: z.union([z.string(), z.null()]).optional(),
  document_type: z.union([z.string(), z.null()]).optional(),
  language: z.union([z.string(), z.null()]).optional(),
  file_format: z.string(),
  publication_date: z.union([z.string(), z.null()]).optional(),
  last_updated_at: z.union([z.string(), z.null()]).optional(),
  discovered_at: z.union([z.string(), z.null()]).optional(),
  status: z.string(),
  duplicate_class: z.union([z.string(), z.null()]).optional(),
  checksum: z.union([z.string(), z.null()]).optional(),
  document_id: z.union([z.string(), z.null()]).optional(),
  revision: z.union([z.number(), z.null()]).optional(),
  extraction_status: z.union([z.string(), z.null()]).optional(),
  ocr_required: z.boolean(),
  page_count: z.number(),
  skip_reason: z.union([z.string(), z.null()]).optional(),
  error_message: z.union([z.string(), z.null()]).optional(),
  metadata: z.record(z.string(), z.unknown()),
  jobs: z.array(IngestionJobSchema).optional(),
})
