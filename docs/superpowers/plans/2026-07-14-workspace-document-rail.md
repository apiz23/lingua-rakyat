# Workspace Document Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the document library visible inside `/workspace` via a collapsible rail, and make empty-state suggested questions reflect documents that actually exist.

**Architecture:** One shared-fetch hook (`useDocuments`) feeds a new compact rail component and (optionally) `ChatPanel`, so the document list is fetched once instead of three times. `EmptyState` gets a `readyDocs` prop and builds chips from a static agency→question map instead of a hardcoded list that references documents that don't exist.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, existing `lib/api.ts` client. No test framework is configured for this UI layer (`frontend/package.json` has no `test` script, no vitest/jest/playwright/@testing-library) — verification is manual via `pnpm dev` + browser, matching how the rest of `frontend/components` is verified in this repo.

## Global Constraints

- Featured agencies actually seeded (verify against `backend/routers/documents.py:44-78` if this ever drifts): `JPN`, `IMIGRESEN`, `KWSP`, `PTPTN`. Do not reference `LHDN` — no such doc is seeded.
- `Document` type (`frontend/lib/api.ts:18-30`): `{ id, name, size_bytes, chunk_count, status: "processing"|"ready"|"error", uploaded_at, error_message?, storage_path?, public_url?, is_featured?, agency? }`.
- `useLanguage()` (`frontend/components/language-provider.tsx`) returns `{ language: "ms"|"en"|"zh", toggleLanguage }`.
- `useLocalStorageSetting<T extends string|boolean>(key, defaultValue): [T, Dispatch<SetStateAction<T>>]` (`frontend/hooks/useLocalStorageSetting.ts`) — SSR-safe boolean/string localStorage state.
- `doc-panel.tsx` (`/manage` page) must not regress — it keeps its own internal fetch untouched.
- Do not touch backend/RAG code in this plan (already fixed separately this session).

---

### Task 1: `useDocuments` shared-fetch hook

**Files:**
- Create: `frontend/hooks/useDocuments.ts`

**Interfaces:**
- Consumes: `listDocuments()` from `frontend/lib/api.ts` (returns `Promise<Document[]>`), `Document` type from same file.
- Produces: `useDocuments(): { documents: Document[]; readyDocs: Document[]; loading: boolean; reload: () => Promise<Document[]> }` — used by Task 4 (rail) and Task 5 (workspace page wiring).

- [ ] **Step 1: Write the hook**

```typescript
// frontend/hooks/useDocuments.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { Document, listDocuments } from "@/lib/api"

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
      return docs
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const readyDocs = documents.filter((d) => d.status === "ready")

  return { documents, readyDocs, loading, reload }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no new errors referencing `useDocuments.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useDocuments.ts
git commit -m "feat(workspace): add shared useDocuments hook"
```

---

### Task 2: Agency-keyed suggested-question map

**Files:**
- Create: `frontend/lib/agency-questions.ts`

**Interfaces:**
- Consumes: nothing (static data).
- Produces: `AGENCY_QUESTION_MAP: Record<string, Record<"ms"|"en"|"zh", string[]>>` and `GENERIC_ASK_CHIP: Record<"ms"|"en"|"zh", string>` — consumed by Task 3 (`EmptyState`).

- [ ] **Step 1: Write the map**

```typescript
// frontend/lib/agency-questions.ts
// Suggested questions keyed by the agencies actually seeded in
// backend/routers/documents.py FEATURED_DOCS. Keep in sync if that list
// changes — a question referencing an agency with no doc yields
// evidence_mode: "insufficient" instead of a real answer.

export type Lang = "ms" | "en" | "zh"

export const AGENCY_QUESTION_MAP: Record<string, Record<Lang, string[]>> = {
  JPN: {
    ms: ["Bagaimana cara memperbaharui MyKad?"],
    en: ["How do I renew my MyKad?"],
    zh: ["如何更新我的MyKad身份证？"],
  },
  IMIGRESEN: {
    ms: ["Apa dokumen diperlukan untuk permohonan pasport?"],
    en: ["What documents do I need to apply for a passport?"],
    zh: ["申请护照需要哪些文件？"],
  },
  KWSP: {
    ms: ["Bagaimana cara reset kata laluan i-Akaun KWSP?"],
    en: ["How do I reset my KWSP i-Akaun password?"],
    zh: ["如何重置我的公积金 i-Akaun 密码？"],
  },
  PTPTN: {
    ms: ["Siapa layak memohon myWaqafPTPTN?"],
    en: ["Who is eligible to apply for myWaqafPTPTN?"],
    zh: ["谁有资格申请 myWaqafPTPTN？"],
  },
}

export const GENERIC_ASK_CHIP: Record<Lang, string> = {
  ms: "Tanya apa-apa tentang dokumen anda",
  en: "Ask anything about your documents",
  zh: "询问关于您文件的任何问题",
}

export const GENERIC_DOC_QUESTION: Record<Lang, (docName: string) => string> = {
  ms: (docName) => `Apa kandungan ${docName}?`,
  en: (docName) => `What does ${docName} cover?`,
  zh: (docName) => `${docName}包含哪些内容？`,
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no new errors referencing `agency-questions.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/agency-questions.ts
git commit -m "feat(workspace): add agency-keyed suggested question map"
```

---

### Task 3: `EmptyState` — doc-derived chips

**Files:**
- Modify: `frontend/components/chat-panel/empty-state.tsx` (full file, currently 97 lines)

**Interfaces:**
- Consumes: `AGENCY_QUESTION_MAP`, `GENERIC_ASK_CHIP`, `GENERIC_DOC_QUESTION`, `Lang` from Task 2's `frontend/lib/agency-questions.ts`; `Document` type from `frontend/lib/api.ts`.
- Produces: `EmptyState` now requires `readyDocs: Document[]` and `docsLoading: boolean` props in addition to existing `onChipClick`. Task 5 must pass these when rendering `<EmptyState>` inside `ChatPanel` (`frontend/components/chat-panel/index.tsx:1024`).

- [ ] **Step 1: Replace the file**

```typescript
// frontend/components/chat-panel/empty-state.tsx
"use client"

import type { LucideIcon } from "lucide-react"
import { FileQuestion, Landmark, Sparkles, Upload } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { Document } from "@/lib/api"
import {
  AGENCY_QUESTION_MAP,
  GENERIC_ASK_CHIP,
  GENERIC_DOC_QUESTION,
  Lang,
} from "@/lib/agency-questions"

interface EmptyStateProps {
  onChipClick: (question: string) => void
  readyDocs: Document[]
  docsLoading: boolean
}

interface Chip {
  icon: LucideIcon
  question: string
}

const GREETING: Record<Lang, { title: string; sub: string; hint: string }> = {
  ms: {
    title: "Selamat datang",
    sub: "Tanya tentang dokumen kerajaan anda",
    hint: "Tekan satu soalan di bawah, atau taip soalan anda sendiri",
  },
  en: {
    title: "Welcome",
    sub: "Ask about your government documents",
    hint: "Tap a question below, or type your own",
  },
  zh: {
    title: "欢迎使用",
    sub: "查询您的政府文件",
    hint: "点击下方问题，或输入您自己的问题",
  },
}

const EMPTY_LIBRARY: Record<Lang, { title: string; sub: string }> = {
  ms: {
    title: "Belum ada dokumen sedia",
    sub: "Muat naik PDF pertama anda untuk mula bertanya",
  },
  en: {
    title: "No documents ready yet",
    sub: "Upload your first PDF to start asking questions",
  },
  zh: {
    title: "尚无可用文件",
    sub: "上传您的第一份PDF即可开始提问",
  },
}

function buildChips(readyDocs: Document[], lang: Lang): Chip[] {
  const chips: Chip[] = []
  const seenAgencies = new Set<string>()

  for (const doc of readyDocs) {
    if (chips.length >= 4) break
    if (!doc.agency || seenAgencies.has(doc.agency)) continue
    const questions = AGENCY_QUESTION_MAP[doc.agency]?.[lang]
    if (!questions || questions.length === 0) continue
    seenAgencies.add(doc.agency)
    chips.push({ icon: Landmark, question: questions[0] })
  }

  const nonFeatured = readyDocs.filter((d) => !d.is_featured)
  if (chips.length < 4 && nonFeatured.length > 0 && nonFeatured.length <= 2) {
    for (const doc of nonFeatured) {
      if (chips.length >= 4) break
      chips.push({
        icon: FileQuestion,
        question: GENERIC_DOC_QUESTION[lang](doc.name),
      })
    }
  }

  if (chips.length < 4) {
    chips.push({ icon: Sparkles, question: GENERIC_ASK_CHIP[lang] })
  }

  return chips
}

export function EmptyState({ onChipClick, readyDocs, docsLoading }: EmptyStateProps) {
  const { language } = useLanguage()
  const lang: Lang = language === "zh" ? "zh" : language === "en" ? "en" : "ms"
  const greeting = GREETING[lang]

  if (docsLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[62px] animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    )
  }

  if (readyDocs.length === 0) {
    const empty = EMPTY_LIBRARY[lang]
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Upload className="h-5 w-5" />
        </span>
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-foreground">
          {empty.title}
        </h1>
        <p className="text-sm text-muted-foreground">{empty.sub}</p>
      </div>
    )
  }

  const chips = buildChips(readyDocs, lang)

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="mb-1 font-display text-3xl font-bold tracking-tight text-foreground">
        {greeting.title}
      </h1>
      <p className="mb-2 text-muted-foreground">{greeting.sub}</p>
      <p className="mb-8 text-sm text-muted-foreground/70">{greeting.hint}</p>

      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {chips.map(({ icon: Icon, question }) => (
          <button
            key={question}
            onClick={() => onChipClick(question)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm leading-snug text-foreground">
              {question}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: errors at every `<EmptyState>` call site missing the new required props — this is expected until Task 5 updates the call site. Confirm the only errors are missing-prop errors on `EmptyState` usage in `frontend/components/chat-panel/index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/chat-panel/empty-state.tsx
git commit -m "feat(workspace): derive empty-state chips from ready documents"
```

---

### Task 4: `WorkspaceDocRail` component

**Files:**
- Create: `frontend/components/workspace-doc-rail.tsx`

**Interfaces:**
- Consumes: `Document` type + `useLocalStorageSetting` + `useLanguage`; icons from `lucide-react`; `UploadModal` from `frontend/components/upload-modal.tsx` (existing, same one `doc-panel.tsx` uses — check its prop signature `{ isOpen, onClose, onUploadComplete }` before wiring, matching `doc-panel.tsx:442-448`).
- Produces: `WorkspaceDocRail(props: { documents: Document[]; loading: boolean; selectedDoc: Document | null; onSelectDoc: (doc: Document) => void; onReload: () => void }): JSX.Element` — used by Task 5 in `workspace/page.tsx`.

- [ ] **Step 1: Write the component**

```typescript
// frontend/components/workspace-doc-rail.tsx
"use client"

import { useState } from "react"
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Landmark,
  Loader2,
  Search,
  Upload,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Document } from "@/lib/api"
import { useLanguage } from "@/components/language-provider"
import { useLocalStorageSetting } from "@/hooks/useLocalStorageSetting"
import UploadModal from "@/components/upload-modal"

interface WorkspaceDocRailProps {
  documents: Document[]
  loading: boolean
  selectedDoc: Document | null
  onSelectDoc: (doc: Document) => void
  onReload: () => void
}

const COPY = {
  ms: {
    title: "Dokumen",
    search: "Cari dokumen...",
    upload: "Muat Naik",
    empty: "Tiada dokumen ditemui",
    emptySearch: "Cuba kata kunci lain",
    loading: "Memuatkan...",
    collapse: "Lipat panel dokumen",
    expand: "Buka panel dokumen",
  },
  en: {
    title: "Documents",
    search: "Search documents...",
    upload: "Upload",
    empty: "No documents found",
    emptySearch: "Try a different search",
    loading: "Loading...",
    collapse: "Collapse document panel",
    expand: "Expand document panel",
  },
  zh: {
    title: "文件",
    search: "搜索文件...",
    upload: "上传",
    empty: "未找到文件",
    emptySearch: "请尝试其他关键词",
    loading: "加载中...",
    collapse: "收起文件面板",
    expand: "展开文件面板",
  },
}

function statusIcon(status: Document["status"]) {
  switch (status) {
    case "ready":
      return <CheckCircle className="h-3 w-3 text-primary" />
    case "processing":
      return <Loader2 className="h-3 w-3 animate-spin text-accent" />
    case "error":
      return <XCircle className="h-3 w-3 text-destructive" />
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />
  }
}

export default function WorkspaceDocRail({
  documents,
  loading,
  selectedDoc,
  onSelectDoc,
  onReload,
}: WorkspaceDocRailProps) {
  const { language } = useLanguage()
  const copy = COPY[language] ?? COPY.ms
  const [open, setOpen] = useLocalStorageSetting<boolean>("lr-doc-rail-open", true)
  const [search, setSearch] = useState("")
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!open) {
    return (
      <div className="hidden shrink-0 border-r border-border/50 bg-background md:flex md:flex-col md:items-center md:py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy.expand}
          title={copy.expand}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="hidden w-72 shrink-0 flex-col border-r border-border/50 bg-background md:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 p-3">
        <span className="text-sm font-semibold text-foreground">{copy.title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            aria-label={copy.upload}
            title={copy.upload}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.collapse}
            title={copy.collapse}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-border/50 p-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.search}
            className="w-full rounded-md border border-border bg-card py-1.5 pr-2 pl-8 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <FileText className="h-5 w-5" />
            <p>{copy.empty}</p>
            {search && <p>{copy.emptySearch}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDoc(doc)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                  selectedDoc?.id === doc.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  {doc.is_featured ? (
                    <Landmark className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="absolute -top-1 -right-1">
                    {statusIcon(doc.status)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {doc.name}
                  </span>
                  {doc.agency && (
                    <span className="text-[10px] text-muted-foreground">{doc.agency}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => {
          setIsUploadOpen(false)
          onReload()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify `UploadModal` prop signature matches**

Run: `grep -n "interface UploadModalProps" -A6 frontend/components/upload-modal.tsx`
Expected: props are `isOpen: boolean`, `onClose: () => void`, `onUploadComplete: () => void` (or compatible). If the signature differs, adjust the `<UploadModal>` call in Step 1 to match — do not modify `upload-modal.tsx`.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no new errors referencing `workspace-doc-rail.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/workspace-doc-rail.tsx
git commit -m "feat(workspace): add collapsible document rail component"
```

---

### Task 5: Wire rail + shared docs into workspace page and ChatPanel

**Files:**
- Modify: `frontend/app/(app)/workspace/page.tsx` (full file, currently 55 lines)
- Modify: `frontend/components/chat-panel/index.tsx:90-98` (props interface), `:270-284` (internal fetch effect), `:1024` (`<EmptyState>` call site)

**Interfaces:**
- Consumes: `useDocuments` (Task 1), `WorkspaceDocRail` (Task 4), `EmptyState` new props (Task 3).
- Produces: `ChatPanel` gains optional props `documents?: Document[]` and `docsLoading?: boolean`. When provided, `ChatPanel` skips its own `listDocuments()` effect and derives `readyDocs` from the prop instead. When absent (e.g. if `ChatPanel` is ever used elsewhere without a parent-level `useDocuments`), existing self-fetch behavior is preserved — this task's `workspace/page.tsx` always provides them.

- [ ] **Step 1: Rewrite `workspace/page.tsx`**

```typescript
// frontend/app/(app)/workspace/page.tsx
"use client"

import { useEffect, useState } from "react"
import { Document } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import WorkspaceDocRail from "@/components/workspace-doc-rail"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { useDocuments } from "@/hooks/useDocuments"

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()
  const { userId, activeSessionId } = useWorkspaceSession()
  const { documents, readyDocs, loading, reload } = useDocuments()

  useEffect(() => {
    // Keep the current doc if it still exists; otherwise auto-anchor on the
    // first ready doc so the citizen lands in a working multi-doc chat with
    // no file picking. selectedDoc is only the session/history anchor — every
    // question still spans the whole ready library (ChatPanel askAllDocs).
    setSelectedDoc(
      (prev) =>
        documents.find((d) => d.id === prev?.id) ??
        documents.find((d) => d.status === "ready") ??
        null
    )
  }, [documents])

  useEffect(() => {
    setInitialQuestion(undefined)
  }, [selectedDoc?.id])

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <WorkspaceDocRail
        documents={documents}
        loading={loading}
        selectedDoc={selectedDoc}
        onSelectDoc={setSelectedDoc}
        onReload={reload}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatPanel
          selectedDoc={selectedDoc}
          sessionId={activeSessionId}
          userId={userId}
          initialQuestion={initialQuestion}
          composerTop={null}
          documents={documents}
          docsLoading={loading}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `ChatPanel` props interface**

In `frontend/components/chat-panel/index.tsx`, find:

```typescript
interface ChatPanelProps {
  selectedDoc: Document | null
  sessionId?: string | null        // externally controlled session
  userId?: string                  // passed from workspace
  onBack?: () => void
  composerTop?: React.ReactNode
  emptyState?: React.ReactNode
  initialQuestion?: string
}
```

Replace with:

```typescript
interface ChatPanelProps {
  selectedDoc: Document | null
  sessionId?: string | null        // externally controlled session
  userId?: string                  // passed from workspace
  onBack?: () => void
  composerTop?: React.ReactNode
  emptyState?: React.ReactNode
  initialQuestion?: string
  documents?: Document[]           // shared list from parent's useDocuments — skips internal fetch when provided
  docsLoading?: boolean
}
```

- [ ] **Step 3: Update the function signature to accept the new props**

Find:

```typescript
export default function ChatPanel({
  selectedDoc,
  sessionId: externalSessionId,
  userId: externalUserId,
  onBack,
  composerTop,
  emptyState,
  initialQuestion,
}: ChatPanelProps) {
```

Replace with:

```typescript
export default function ChatPanel({
  selectedDoc,
  sessionId: externalSessionId,
  userId: externalUserId,
  onBack,
  composerTop,
  emptyState,
  initialQuestion,
  documents: externalDocuments,
  docsLoading: externalDocsLoading,
}: ChatPanelProps) {
```

- [ ] **Step 4: Skip internal fetch when `externalDocuments` is provided**

Find (around line 270-284):

```typescript
  // Keep the list of ready docs fresh so multi-doc mode spans the whole library.
  useEffect(() => {
    let active = true
    listDocuments()
      .then((docs) => {
        if (!active) return
        setReadyDocs(docs.filter((d) => d.status === "ready"))
      })
      .catch(() => {
        /* offline / fetch failure — multi-doc simply stays single-doc */
      })
    return () => {
      active = false
    }
  }, [selectedDoc])
```

Replace with:

```typescript
  // Keep the list of ready docs fresh so multi-doc mode spans the whole
  // library. When a parent provides `documents` (workspace page's shared
  // useDocuments), skip the internal fetch entirely — avoids a duplicate
  // listDocuments() call.
  useEffect(() => {
    if (externalDocuments) {
      setReadyDocs(externalDocuments.filter((d) => d.status === "ready"))
      return
    }

    let active = true
    listDocuments()
      .then((docs) => {
        if (!active) return
        setReadyDocs(docs.filter((d) => d.status === "ready"))
      })
      .catch(() => {
        /* offline / fetch failure — multi-doc simply stays single-doc */
      })
    return () => {
      active = false
    }
  }, [selectedDoc, externalDocuments])
```

- [ ] **Step 5: Pass `readyDocs`/loading into `EmptyState`**

Find (around line 1024):

```typescript
                <EmptyState onChipClick={(q) => submitQuestion(q)} />
```

Replace with:

```typescript
                <EmptyState
                  onChipClick={(q) => submitQuestion(q)}
                  readyDocs={readyDocs}
                  docsLoading={externalDocsLoading ?? false}
                />
```

- [ ] **Step 6: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/(app)/workspace/page.tsx" frontend/components/chat-panel/index.tsx
git commit -m "feat(workspace): wire document rail and shared doc list into workspace"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

Run: `cd frontend && pnpm dev`

- [ ] **Step 2: Verify rail visibility and collapse**

Open `/workspace` in a desktop-width browser window. Confirm:
- Left rail is visible by default, listing seeded docs (JPN MyKad, Imigresen passport ×2, KWSP e-Caruman, PTPTN myWaqaf) grouped implicitly by the order returned from `listDocuments()`.
- Click the collapse chevron — rail shrinks to icon-only strip, state persists across a page reload (`localStorage["lr-doc-rail-open"]` is `"false"`).
- Click expand — rail returns.

- [ ] **Step 3: Verify doc selection**

Click a document in the rail. Confirm the chat footer's `Attachment` component (bottom-left, existing UI) updates its title to the clicked doc's name.

- [ ] **Step 4: Verify chips reflect real docs**

With no active chat session, confirm the empty-state chips reference JPN/IMIGRESEN/KWSP/PTPTN topics (MyKad, passport, e-Caruman, myWaqaf) — no LHDN or tax-filing chip should appear. Click one chip and confirm the answer comes back with `evidence_mode` other than `"insufficient"` (visible in network tab response or via the confidence badge in the UI, not a "Sorry — I can't answer confidently" message).

- [ ] **Step 5: Verify `/manage` unaffected**

Open `/manage`. Confirm the existing full document panel (`doc-panel.tsx`) still loads, searches, and uploads correctly — this page does not use `useDocuments` and should behave exactly as before.

- [ ] **Step 6: Scoped lint check**

Run: `cd frontend && pnpm exec eslint hooks/useDocuments.ts lib/agency-questions.ts components/workspace-doc-rail.tsx components/chat-panel/empty-state.tsx "app/(app)/workspace/page.tsx" components/chat-panel/index.tsx`
Expected: no new errors on the files this plan touched (repo-wide `pnpm lint` has ~46 pre-existing errors in unrelated files — don't chase those).

- [ ] **Step 7: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "fix(workspace): address manual verification fixups"
```

(Skip this step if no fixups were needed.)
