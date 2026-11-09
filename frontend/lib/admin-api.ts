// Admin API client. All calls go through the shared authenticated transport.
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

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const send = () =>
    authorizedFetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(init?.headers as Record<string, string> | undefined),
      },
    })

  let response = await send()

  // Read-only admin calls get one retry for transient role-store/JWKS
  // availability failures. Mutations are never retried automatically.
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
    const body = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new AdminApiError(
      body?.detail ??
        "Admin services are unavailable. The role provider or admin tables may not be configured.",
      503,
      "unavailable"
    )
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new AdminApiError(
      body?.detail ?? "Admin request failed.",
      response.status,
      "error"
    )
  }
  return response.json() as Promise<T>
}

export type AdminDocument = {
  id: string
  name: string
  size_bytes: number
  chunk_count: number
  status: "processing" | "ready" | "error" | string
  uploaded_at: string
  agency?: string | null
  is_featured: boolean
  visibility_scope: string
  publication_status: string
  source_id?: string | null
  source_type?: string | null
  owner_type?: string | null
  approved_by?: string | null
  approved_at?: string | null
  published_at?: string | null
  expires_at?: string | null
  last_verified_at?: string | null
  current_revision: number
  error_message?: string | null
  has_storage: boolean
  source?: AdminSource | null
  revision?: AdminRevision | null
  revisions?: AdminRevision[]
  events?: PublicationEvent[]
  blockers?: string[]
}

export type AdminRevision = {
  revision: number
  source_id?: string | null
  source_type?: string | null
  checksum?: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at?: string | null
  superseded_at?: string | null
  revoked_at?: string | null
  has_storage: boolean
  is_current: boolean
  indexing_status?: string
  indexed_at?: string | null
  chunk_count?: number
  index_error?: string | null
  review_status?: string
  review_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export type PublicationEvent = {
  id?: number
  event_type: string
  actor?: string
  occurred_at?: string
  details?: Record<string, unknown>
}

export type AdminSource = {
  source_id: string
  issuing_organization: string
  authority?: string | null
  source_url?: string | null
  source_type: string
  verification_status: string
  verified_by?: string | null
  verified_at?: string | null
  usage_rights?: string | null
  usage_permitted: boolean
  freshness_days?: number | null
  last_verified_at?: string | null
  revoked_at?: string | null
  metadata: Record<string, unknown>
  created_at?: string | null
  updated_at?: string | null
}

export type DashboardMetrics = {
  total_documents: number
  awaiting_review: number
  published: number
  approved: number
  rejected: number
  suspended: number
  withdrawn: number
  expiring: number
  expired: number
  unverified_sources: number
  failed_ingestion: number
}

export type AuditEntry = {
  id?: number
  actor_id?: string
  actor_role?: string
  action?: string
  target_type?: string
  target_id?: string
  reason?: string
  state_from?: string
  state_to?: string
  correlation_id?: string
  details?: Record<string, unknown>
  created_at?: string
}

export type DashboardResponse = {
  generated_at: string
  metrics: DashboardMetrics
  recent_activity: AuditEntry[]
}

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
  return adminFetch<DashboardResponse>("/dashboard")
}

export function listAdminDocuments(filters: DocumentFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null)
      params.set(key, String(value))
  }
  return adminFetch<Paginated<AdminDocument>>(`/documents?${params.toString()}`)
}

export function getAdminDocument(id: string) {
  return adminFetch<AdminDocument>(`/documents/${encodeURIComponent(id)}`)
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
  return adminFetch<AdminDocument>(`/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  })
}

export function uploadAdminDocument(file: File, sourceId?: string) {
  const form = new FormData()
  form.append("file", file)
  if (sourceId) form.append("source_id", sourceId)
  return adminFetch<{ id: string; name: string; status: string }>(
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
  return adminFetch<AdminSource[]>(`/sources?${search.toString()}`)
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
  return adminFetch<AdminSource>("/sources", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateAdminSource(
  sourceId: string,
  payload: Record<string, unknown>
) {
  return adminFetch<AdminSource>(`/sources/${encodeURIComponent(sourceId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
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
  return adminFetch<AdminSource>(
    `/sources/${encodeURIComponent(sourceId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )
}

export function revokeAdminSource(sourceId: string, reason: string) {
  return adminFetch<AdminSource>(
    `/sources/${encodeURIComponent(sourceId)}/revoke`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function getReviewQueue() {
  return adminFetch<AdminDocument[]>("/review-queue")
}

export function reviewAdminDocument(
  id: string,
  action: "approve" | "reject" | "request_changes",
  reason?: string
) {
  return adminFetch<AdminDocument>(
    `/documents/${encodeURIComponent(id)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }
  )
}

export function publishAdminDocument(id: string, reason?: string) {
  return adminFetch<AdminDocument>(
    `/documents/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function suspendAdminDocument(id: string, reason: string) {
  return adminFetch<AdminDocument>(
    `/documents/${encodeURIComponent(id)}/suspend`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function withdrawAdminDocument(id: string, reason: string) {
  return adminFetch<AdminDocument>(
    `/documents/${encodeURIComponent(id)}/withdraw`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  )
}

export function listAdminRevisions(id: string) {
  return adminFetch<AdminRevision[]>(
    `/documents/${encodeURIComponent(id)}/revisions`
  )
}

export function reviewAdminRevision(
  documentId: string,
  revision: number,
  action: "approve" | "reject" | "request_changes",
  reason?: string
) {
  return adminFetch<AdminRevision>(
    `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/review`,
    { method: "POST", body: JSON.stringify({ action, reason }) }
  )
}

export function promoteAdminRevision(
  documentId: string,
  revision: number,
  reason?: string
) {
  return adminFetch<AdminRevision>(
    `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/promote`,
    { method: "POST", body: JSON.stringify({ reason }) }
  )
}

export function rollbackAdminRevision(
  documentId: string,
  revision: number,
  reason: string
) {
  return adminFetch<AdminRevision>(
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
  return adminFetch<Paginated<AuditEntry>>(`/audit-logs?${search.toString()}`)
}

export type RoleAssignment = {
  id?: number
  actor_id: string
  role: string
  granted_by?: string
  granted_at?: string
  revoked_at?: string | null
  revoked_by?: string | null
  reason?: string
}

export function listAdminRoles() {
  return adminFetch<{
    roles: RoleAssignment[]
    available_roles: string[]
    role_permissions: Record<string, string[]>
  }>("/roles")
}

export function grantAdminRole(payload: {
  target_actor_id: string
  role: string
  reason?: string
}) {
  return adminFetch<RoleAssignment>("/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function revokeAdminRole(payload: {
  target_actor_id: string
  role: string
  reason: string
}) {
  return adminFetch<RoleAssignment>("/roles/revoke", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getAdminStatus() {
  return adminFetch<{
    generated_at: string
    checks: Record<string, string>
    role_provider: string
    environment: string
  }>("/status")
}

// ── Ingestion pipeline ─────────────────────────────────────────────────────

export type IngestionCandidate = {
  id: string
  source_id: string
  external_id?: string | null
  source_url: string
  canonical_url: string
  title?: string | null
  issuing_organization?: string | null
  document_type?: string | null
  language?: string | null
  file_format: string
  publication_date?: string | null
  last_updated_at?: string | null
  discovered_at?: string | null
  status: string
  duplicate_class?: string | null
  checksum?: string | null
  document_id?: string | null
  revision?: number | null
  extraction_status?: string | null
  ocr_required: boolean
  page_count: number
  skip_reason?: string | null
  error_message?: string | null
  metadata: Record<string, unknown>
  jobs?: IngestionJob[]
}

export type IngestionJob = {
  id: string
  job_type: "discovery" | "ingest"
  source_id?: string | null
  candidate_id?: string | null
  document_id?: string | null
  status: string
  stage?: string | null
  progress: number
  attempts: number
  max_attempts: number
  error_message?: string | null
  details: Record<string, unknown>
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export type IngestionOverview = {
  generated_at: string
  candidates: Record<string, number>
  jobs: Record<string, number>
  documents: {
    awaiting_review: number
    ocr_required: number
    failed_processing: number
  }
  sources: Array<{
    source_id: string
    issuing_organization: string
    source_type: string
    verification_status: string
    last_discovered_at?: string | null
    last_error?: string | null
  }>
}

export function getIngestionOverview() {
  return adminFetch<IngestionOverview>("/ingestion/overview")
}

export function startAdminDiscovery(sourceId: string) {
  return adminFetch<IngestionJob>(
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
  return adminFetch<Paginated<IngestionCandidate>>(
    `/ingestion/candidates?${search.toString()}`
  )
}

export function getIngestionCandidate(id: string) {
  return adminFetch<IngestionCandidate>(
    `/ingestion/candidates/${encodeURIComponent(id)}`
  )
}

export function ingestCandidate(id: string) {
  return adminFetch<IngestionJob>(
    `/ingestion/candidates/${encodeURIComponent(id)}/ingest`,
    {
      method: "POST",
    }
  )
}

export function skipCandidate(id: string, reason: string) {
  return adminFetch<IngestionCandidate>(
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
  return adminFetch<Paginated<IngestionJob>>(
    `/ingestion/jobs?${search.toString()}`
  )
}

export function retryIngestionJob(id: string) {
  return adminFetch<IngestionJob>(
    `/ingestion/jobs/${encodeURIComponent(id)}/retry`,
    {
      method: "POST",
    }
  )
}

export function cancelIngestionJob(id: string) {
  return adminFetch<IngestionJob>(
    `/ingestion/jobs/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
    }
  )
}

export function getDocumentProcessing(documentId: string) {
  return adminFetch<{
    document_id: string
    status: string
    extraction_status?: string | null
    extraction_method?: string | null
    ocr_required: boolean
    page_count: number
    chunk_count: number
    publication_status: string
    visibility_scope: string
    error_message?: string | null
    revisions: Array<{
      revision: number
      checksum?: string | null
      approved: boolean
      current: boolean
      created_at?: string | null
      requires_review: boolean
    }>
  }>(`/documents/${encodeURIComponent(documentId)}/processing`)
}

export function reprocessAdminDocument(documentId: string) {
  return adminFetch<IngestionJob>(
    `/documents/${encodeURIComponent(documentId)}/reprocess`,
    {
      method: "POST",
    }
  )
}
