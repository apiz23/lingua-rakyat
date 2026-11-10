import { adminHeaders } from "./admin-headers"
import { z } from "zod"
import {
  DashboardMetricsSchema,
  AuditEntrySchema,
  DashboardResponseSchema,
  PaginatedSchema,
  AdminSourceSchema,
  AdminRevisionSchema,
  PublicationEventSchema,
  AdminDocumentSchema,
  RoleAssignmentSchema,
  IngestionOverviewSchema,
  IngestionJobSchema,
  IngestionCandidateSchema,
} from "./admin-schemas"
import { authorizedFetch } from "@/lib/http"

export class AdminApiError extends Error {
  readonly status: number
  readonly code: "unauthorized" | "forbidden" | "unavailable" | "error"

  constructor(message: string, status: number, code: AdminApiError["code"]) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.code = code
  }
}

const BASE = "/api/v1/admin"

async function adminFetch<T>(
  schema: z.ZodType<T>,
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = adminHeaders(init)
  const send = () =>
    authorizedFetch(`${BASE}${path}`, {
      ...init,
      headers,
    })

  let response = await send()

  const method = (init?.method ?? "GET").toUpperCase()
  if (response.status === 503 && method === "GET") {
    await new Promise((resolve) => setTimeout(resolve, 400))
    response = await send()
  }

  if (response.status === 401) {
    throw new AdminApiError(
      "Sign in required for administration.",
      401,
      "unauthorized"
    )
  }
  if (response.status === 403) {
    throw new AdminApiError(
      "You do not have permission for this action.",
      403,
      "forbidden"
    )
  }
  if (response.status === 503) {
    const raw: unknown = await response.json().catch(() => null)
    const body = z.object({ detail: z.string().optional() }).safeParse(raw)
    throw new AdminApiError(
      (body.success ? body.data.detail : undefined) ??
        "Admin services are unavailable. The role provider or admin tables may not be configured.",
      503,
      "unavailable"
    )
  }
  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => null)
    const body = z.object({ detail: z.string().optional() }).safeParse(raw)
    throw new AdminApiError(
      (body.success ? body.data.detail : undefined) ?? "Admin request failed.",
      response.status,
      "error"
    )
  }
  const raw: unknown = await response.json().catch(() => undefined)
  const parsed = schema.safeParse(raw)
  if (!parsed.success)
    throw new AdminApiError(
      "Admin service returned an invalid response.",
      response.status,
      "error"
    )
  return parsed.data
}

export type AdminDocument = z.infer<typeof AdminDocumentSchema>

export type AdminRevision = z.infer<typeof AdminRevisionSchema>

export type PublicationEvent = z.infer<typeof PublicationEventSchema>

export type AdminSource = z.infer<typeof AdminSourceSchema>

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>

export type AuditEntry = z.infer<typeof AuditEntrySchema>

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type DocumentFilters = {
  q?: string
  processing_status?: string
  visibility?: string
  publication_status?: string
  source_id?: string
  uploaded_from?: string
  uploaded_to?: string
  sort?: string
  order?: string
  page?: number
  page_size?: number
}

export function getDashboard() {
  return adminFetch(DashboardResponseSchema, "/dashboard")
}

export function listAdminDocuments(filters: DocumentFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null)
      params.set(key, String(value))
  }
  return adminFetch(
    PaginatedSchema(AdminDocumentSchema),
    `/documents?${params.toString()}`
  )
}

export function getAdminDocument(id: string) {
  return adminFetch(AdminDocumentSchema, `/documents/${encodeURIComponent(id)}`)
}

export function updateAdminDocument(
  id: string,
  updates: Partial<
    Pick<
      AdminDocument,
      "name" | "agency" | "is_featured" | "expires_at" | "source_id"
    >
  >
) {
  return adminFetch(
    AdminDocumentSchema,
    `/documents/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  )
}

export function uploadAdminDocument(file: File, sourceId?: string) {
  const form = new FormData()
  form.append("file", file)
  if (sourceId) form.append("source_id", sourceId)
  return adminFetch(
    z.object({ id: z.string(), name: z.string(), status: z.string() }),
    "/documents/upload",
    {
      method: "POST",
      body: form,
    }
  )
}

export function listAdminSources(
  params: { q?: string; verification_status?: string } = {}
) {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.verification_status)
    search.set("verification_status", params.verification_status)
  return adminFetch(z.array(AdminSourceSchema), `/sources?${search.toString()}`)
}

export function createAdminSource(payload: {
  source_id: string
  issuing_organization: string
  source_type: string
  authority?: string
  source_url?: string
  usage_rights?: string
  freshness_days?: number
}) {
  return adminFetch(AdminSourceSchema, "/sources", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateAdminSource(
  sourceId: string,
  payload: Record<string, unknown>
) {
  return adminFetch(
    AdminSourceSchema,
    `/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  )
}

export function verifyAdminSource(
  sourceId: string,
  payload: {
    evidence: string
    freshness_days: number
    usage_rights: string
    usage_permitted: boolean
  }
) {
  return adminFetch(
    AdminSourceSchema,
    `/sources/${encodeURIComponent(sourceId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )
}

export function revokeAdminSource(sourceId: string, reason: string) {
  return adminFetch(
    AdminSourceSchema,
    `/sources/${encodeURIComponent(sourceId)}/revoke`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function getReviewQueue() {
  return adminFetch(z.array(AdminDocumentSchema), "/review-queue")
}

export function reviewAdminDocument(
  id: string,
  action: "approve" | "reject" | "request_changes",
  reason?: string
) {
  return adminFetch(
    AdminDocumentSchema,
    `/documents/${encodeURIComponent(id)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }
  )
}

export function publishAdminDocument(id: string, reason?: string) {
  return adminFetch(
    AdminDocumentSchema,
    `/documents/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function suspendAdminDocument(id: string, reason: string) {
  return adminFetch(
    AdminDocumentSchema,
    `/documents/${encodeURIComponent(id)}/suspend`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function withdrawAdminDocument(id: string, reason: string) {
  return adminFetch(
    AdminDocumentSchema,
    `/documents/${encodeURIComponent(id)}/withdraw`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function listAdminRevisions(id: string) {
  return adminFetch(
    z.array(AdminRevisionSchema),
    `/documents/${encodeURIComponent(id)}/revisions`
  )
}

export function reviewAdminRevision(
  documentId: string,
  revision: number,
  action: "approve" | "reject" | "request_changes",
  reason?: string
) {
  return adminFetch(
    AdminRevisionSchema,
    `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/review`,
    { method: "POST", body: JSON.stringify({ action, reason }) }
  )
}

export function promoteAdminRevision(
  documentId: string,
  revision: number,
  reason?: string
) {
  return adminFetch(
    AdminRevisionSchema,
    `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/promote`,
    { method: "POST", body: JSON.stringify({ reason }) }
  )
}

export function rollbackAdminRevision(
  documentId: string,
  revision: number,
  reason: string
) {
  return adminFetch(
    AdminRevisionSchema,
    `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/rollback`,
    { method: "POST", body: JSON.stringify({ reason }) }
  )
}

export function listAdminAudit(
  params: {
    action?: string
    actor_id?: string
    target_id?: string
    page?: number
  } = {}
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return adminFetch(
    PaginatedSchema(AuditEntrySchema),
    `/audit-logs?${search.toString()}`
  )
}

export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>

export function listAdminRoles() {
  return adminFetch(
    z.object({
      roles: z.array(RoleAssignmentSchema),
      available_roles: z.array(z.string()),
      role_permissions: z.record(z.string(), z.array(z.string())),
    }),
    "/roles"
  )
}

export function grantAdminRole(payload: {
  target_actor_id: string
  role: string
  reason?: string
}) {
  return adminFetch(RoleAssignmentSchema, "/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function revokeAdminRole(payload: {
  target_actor_id: string
  role: string
  reason: string
}) {
  return adminFetch(RoleAssignmentSchema, "/roles/revoke", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getAdminStatus() {
  return adminFetch(
    z.object({
      generated_at: z.string(),
      checks: z.record(z.string(), z.string()),
      role_provider: z.string(),
      environment: z.string(),
    }),
    "/status"
  )
}


export type IngestionCandidate = z.infer<typeof IngestionCandidateSchema>

export type IngestionJob = z.infer<typeof IngestionJobSchema>

export type IngestionOverview = z.infer<typeof IngestionOverviewSchema>

export function getIngestionOverview() {
  return adminFetch(IngestionOverviewSchema, "/ingestion/overview")
}

export function startAdminDiscovery(sourceId: string) {
  return adminFetch(
    IngestionJobSchema,
    `/ingestion/sources/${encodeURIComponent(sourceId)}/discover`,
    {
      method: "POST",
    }
  )
}

export function listIngestionCandidates(
  params: {
    source_id?: string
    status?: string
    q?: string
    page?: number
    page_size?: number
  } = {}
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return adminFetch(
    PaginatedSchema(IngestionCandidateSchema),
    `/ingestion/candidates?${search.toString()}`
  )
}

export function getIngestionCandidate(id: string) {
  return adminFetch(
    IngestionCandidateSchema,
    `/ingestion/candidates/${encodeURIComponent(id)}`
  )
}

export function ingestCandidate(id: string) {
  return adminFetch(
    IngestionJobSchema,
    `/ingestion/candidates/${encodeURIComponent(id)}/ingest`,
    {
      method: "POST",
    }
  )
}

export function skipCandidate(id: string, reason: string) {
  return adminFetch(
    IngestionCandidateSchema,
    `/ingestion/candidates/${encodeURIComponent(id)}/skip`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function listIngestionJobs(
  params: {
    status?: string
    job_type?: string
    page?: number
    page_size?: number
  } = {}
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return adminFetch(
    PaginatedSchema(IngestionJobSchema),
    `/ingestion/jobs?${search.toString()}`
  )
}

export function retryIngestionJob(id: string) {
  return adminFetch(
    IngestionJobSchema,
    `/ingestion/jobs/${encodeURIComponent(id)}/retry`,
    {
      method: "POST",
    }
  )
}

export function cancelIngestionJob(id: string) {
  return adminFetch(
    IngestionJobSchema,
    `/ingestion/jobs/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
    }
  )
}

export function getDocumentProcessing(documentId: string) {
  return adminFetch(
    z.object({
      document_id: z.string(),
      status: z.string(),
      extraction_status: z.union([z.string(), z.null()]).optional(),
      extraction_method: z.union([z.string(), z.null()]).optional(),
      ocr_required: z.boolean(),
      page_count: z.number(),
      chunk_count: z.number(),
      publication_status: z.string(),
      visibility_scope: z.string(),
      error_message: z.union([z.string(), z.null()]).optional(),
      revisions: z.array(
        z.object({
          revision: z.number(),
          checksum: z.union([z.string(), z.null()]).optional(),
          approved: z.boolean(),
          current: z.boolean(),
          created_at: z.union([z.string(), z.null()]).optional(),
          requires_review: z.boolean(),
        })
      ),
    }),
    `/documents/${encodeURIComponent(documentId)}/processing`
  )
}

export function reprocessAdminDocument(documentId: string) {
  return adminFetch(
    IngestionJobSchema,
    `/documents/${encodeURIComponent(documentId)}/reprocess`,
    {
      method: "POST",
    }
  )
}
