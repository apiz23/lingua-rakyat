# PDF Viewer with Passage Highlight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the source PDF in a side panel when a citation pill or source card "view" button is clicked, with the cited passage highlighted in yellow.

**Architecture:** A new `PdfPanel` component (react-pdf) renders beside the chat in a flex split layout managed by `ChatPanel`. `AIMessageCard` gets an `onOpenPdf` callback prop; pill clicks and source card "view" buttons call it. `ChatPanel` holds `pdfViewerState` and passes the URL + page + text down to `PdfPanel`. The existing iframe Dialog in `AIMessageCard` is removed.

**Tech Stack:** react-pdf v9 (pdfjs-dist wrapper), copy-webpack-plugin (production worker copy), pnpm, TypeScript, Tailwind CSS, FastAPI (signed URL fallback endpoint).

---

## File Map

| File | Change |
|---|---|
| `frontend/next.config.mjs` | Add `canvas = false` alias + CopyPlugin for pdf.worker |
| `frontend/public/pdf.worker.min.mjs` | NEW — copied from pdfjs-dist after install |
| `frontend/app/globals.css` | Add `.pdf-hl` highlight class |
| `frontend/components/chat-panel/pdf-panel.tsx` | NEW — react-pdf panel component |
| `frontend/components/chat-panel/message-cards.tsx` | Add `onOpenPdf` prop, update pill + source card, remove iframe Dialog |
| `frontend/components/chat-panel/index.tsx` | Add `pdfViewerState`, split layout, wire `onOpenPdf` |
| `backend/routers/documents.py` | Add `GET /{id}/pdf-url` signed URL endpoint |

---

## Task 1: Install dependencies and configure Next.js webpack

**Files:**
- Modify: `frontend/package.json` + `frontend/pnpm-lock.yaml` (via pnpm)
- Modify: `frontend/next.config.mjs`
- Create: `frontend/public/pdf.worker.min.mjs` (copied from node_modules)

- [ ] **Step 1: Install react-pdf**

```bash
cd frontend && pnpm add react-pdf
```

Expected: `react-pdf` and `pdfjs-dist` appear in `package.json` dependencies.

- [ ] **Step 2: Install copy-webpack-plugin as dev dependency**

```bash
pnpm add -D copy-webpack-plugin
```

Expected: `copy-webpack-plugin` appears in `devDependencies`.

- [ ] **Step 3: Copy PDF.js worker to public folder**

Run this from the `frontend/` directory:

```bash
node -e "require('fs').cpSync('./node_modules/pdfjs-dist/build/pdf.worker.min.mjs', './public/pdf.worker.min.mjs')"
```

Expected: `frontend/public/pdf.worker.min.mjs` now exists (it will be a large `.mjs` file, ~1 MB).

> **Why:** Turbopack (used for `pnpm dev`) does not run webpack plugins, so the worker must already be in `public/` for dev. CopyPlugin (added next) handles production builds.

- [ ] **Step 4: Update next.config.mjs**

Current content of `frontend/next.config.mjs`:
```js
import createMDX from "@next/mdx"

const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  allowedDevOrigins: ["http://192.168.0.108:3000", "http://192.168.1.14:3000"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.microlink.io" },
      { protocol: "https", hostname: "thesvg.org" },
    ],
  },
}

const withMDX = createMDX()
export default withMDX(nextConfig)
```

Replace with:
```js
import createMDX from "@next/mdx"
import CopyPlugin from "copy-webpack-plugin"

const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  allowedDevOrigins: ["http://192.168.0.108:3000", "http://192.168.1.14:3000"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.microlink.io" },
      { protocol: "https", hostname: "thesvg.org" },
    ],
  },
  webpack: (config, { isServer }) => {
    // react-pdf / PDF.js: disable canvas (not needed for text rendering)
    config.resolve.alias.canvas = false
    // Copy PDF.js worker to public/ for production builds
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
              to: "../public/pdf.worker.min.mjs",
            },
          ],
        })
      )
    }
    return config
  },
}

const withMDX = createMDX()
export default withMDX(nextConfig)
```

- [ ] **Step 5: Verify TypeScript accepts the config**

```bash
pnpm typecheck
```

Expected: no errors (or only pre-existing errors unrelated to this task).

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/package.json frontend/pnpm-lock.yaml frontend/next.config.mjs frontend/public/pdf.worker.min.mjs
git commit -m "feat: install react-pdf, configure pdf.worker and webpack canvas alias"
```

---

## Task 2: Add PDF highlight CSS and create PdfPanel component

**Files:**
- Modify: `frontend/app/globals.css`
- Create: `frontend/components/chat-panel/pdf-panel.tsx`

- [ ] **Step 1: Add `.pdf-hl` class to globals.css**

Append to the end of `frontend/app/globals.css`:

```css
/* PDF passage highlight — react-pdf customTextRenderer */
.pdf-hl {
  background: oklch(0.85 0.15 85 / 0.65);
  padding: 1px 0;
  border-radius: 2px;
}
```

- [ ] **Step 2: Create the PdfPanel component**

Create `frontend/components/chat-panel/pdf-panel.tsx` with the full content below:

```tsx
"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileX,
  Loader2,
  X,
} from "lucide-react"

// Set worker once, outside component — must match the file copied to public/
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface PdfPanelProps {
  url: string               // Supabase public_url (or signed URL after fallback)
  targetPage: number        // Page to open immediately
  highlightText: string | null  // source.text from the chunk — used for highlighting
  docName: string           // Shown in panel header
  documentId: string        // Used for signed URL fallback fetch
  language: string          // "ms" | "en"
  onClose: () => void
  className?: string
}

function PdfLoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function PdfErrorState({
  language,
  onRetry,
}: {
  language: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <FileX className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {language === "ms" ? "Gagal memuatkan PDF." : "Failed to load PDF."}
      </p>
      <button
        onClick={onRetry}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        {language === "ms" ? "Cuba semula" : "Try again"}
      </button>
    </div>
  )
}

export default function PdfPanel({
  url,
  targetPage,
  highlightText,
  docName,
  documentId,
  language,
  onClose,
  className,
}: PdfPanelProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(targetPage)
  const [hasTextLayer, setHasTextLayer] = useState<boolean | null>(null) // null = unknown
  const [loadError, setLoadError] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(url)
  const [panelWidth, setPanelWidth] = useState(420)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track whether the signed URL fallback was already attempted
  const triedSignedRef = useRef(false)

  // When targetPage changes (user clicks a different pill), jump to that page
  useEffect(() => {
    setCurrentPage(targetPage)
    setHasTextLayer(null)
  }, [targetPage])

  // When url prop changes (document switched), reset resolved URL and error
  useEffect(() => {
    setResolvedUrl(url)
    setLoadError(false)
    triedSignedRef.current = false
  }, [url])

  // Track panel container width so the PDF fills the panel at any size
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Only highlight on the targetPage; other pages render without marks
  const activeHighlight = currentPage === targetPage ? highlightText : null

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!activeHighlight || str.trim().length < 3) return str
      const inChunk = activeHighlight
        .toLowerCase()
        .includes(str.toLowerCase().trim())
      if (inChunk) return `<mark class="pdf-hl">${str}</mark>`
      return str
    },
    [activeHighlight]
  )

  const fetchSignedUrl = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/documents/${documentId}/pdf-url`
      )
      if (!res.ok) throw new Error("signed url fetch failed")
      const { url: signedUrl } = (await res.json()) as { url: string }
      setResolvedUrl(signedUrl)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }

  const handleLoadError = () => {
    if (!triedSignedRef.current) {
      // First failure: try signed URL fallback (for private Supabase buckets)
      triedSignedRef.current = true
      fetchSignedUrl()
    } else {
      // Signed URL also failed — show error state
      setLoadError(true)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col border-l border-border bg-background",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-xs font-medium text-foreground">
          {docName}
        </span>
        <button onClick={onClose} aria-label="Close PDF viewer">
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Scanned PDF banner — shown when PDF has no text layer but highlight was requested */}
      {hasTextLayer === false && highlightText && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {language === "ms"
              ? "Penyerlahan teks tidak tersedia untuk dokumen imbasan."
              : "Text highlighting unavailable for scanned documents."}
          </span>
        </div>
      )}

      {/* PDF canvas — scrollable */}
      <div className="flex-1 overflow-y-auto bg-[#525659]">
        {loadError ? (
          <PdfErrorState
            language={language}
            onRetry={() => {
              setLoadError(false)
              setResolvedUrl(url)
              triedSignedRef.current = false
            }}
          />
        ) : (
          <Document
            file={resolvedUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={handleLoadError}
            loading={<PdfLoadingSpinner />}
          >
            <Page
              pageNumber={currentPage}
              width={panelWidth - 24}
              customTextRenderer={customTextRenderer}
              onGetTextSuccess={(textContent) => {
                setHasTextLayer(textContent.items.length > 0)
              }}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              loading={<PdfLoadingSpinner />}
            />
          </Document>
        )}
      </div>

      {/* Footer — page navigation */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-3">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[11px] text-muted-foreground">
          {language === "ms" ? "Halaman" : "Page"} {currentPage}
          {numPages ? ` / ${numPages}` : ""}
        </span>
        <button
          onClick={() =>
            setCurrentPage((p) => Math.min(numPages ?? p, p + 1))
          }
          disabled={numPages !== null && currentPage >= numPages}
          aria-label="Next page"
          className="disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/app/globals.css frontend/components/chat-panel/pdf-panel.tsx
git commit -m "feat: add PdfPanel component with text highlighting and scanned PDF detection"
```

---

## Task 3: Update message-cards.tsx — add onOpenPdf, remove iframe Dialog

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

> **Context:** `AIMessageCard` currently has a `viewerPage` state and renders an iframe Dialog at the bottom. We replace this with an `onOpenPdf` callback prop. The Dialog and its imports are removed entirely.

- [ ] **Step 1: Remove Dialog imports**

In `frontend/components/chat-panel/message-cards.tsx`, find and delete these lines (currently lines 25–30):

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
```

- [ ] **Step 2: Remove the viewerPage state**

Find and delete this line (currently around line 209):

```tsx
const [viewerPage, setViewerPage] = React.useState<number | null>(null)
```

- [ ] **Step 3: Add onOpenPdf to the props destructuring and type**

The props block for `AIMessageCard` currently looks like this (around line 180–198):

```tsx
export function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
  docPublicUrl,
  autoSpeak,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
  autoSpeak?: boolean
}) {
```

Replace with:

```tsx
export function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
  docPublicUrl,
  autoSpeak,
  onOpenPdf,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
  autoSpeak?: boolean
  onOpenPdf?: (page: number, text: string | null) => void
}) {
```

- [ ] **Step 4: Update handlePillClick to call onOpenPdf**

Find the current `handlePillClick` (around line 213–228):

```tsx
const handlePillClick = React.useCallback(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (sourceIndex: number, _pageStart: number) => {
    // Open sources panel if closed
    if (!expandedSources.has(index)) toggleSources(index)
    // Cancel any in-flight highlight timer (prevents stacked timers on rapid clicks)
    if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
    setHighlightedSourceIdx(sourceIndex)
    highlightTimerRef.current = setTimeout(() => {
      highlightTimerRef.current = null
      setHighlightedSourceIdx(null)
    }, 1500)
  },
  [expandedSources, toggleSources, index]
)
```

Replace with:

```tsx
const handlePillClick = React.useCallback(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (sourceIndex: number, _pageStart: number) => {
    const source = message.sources[sourceIndex]
    // Open PDF panel with cited passage highlighted
    onOpenPdf?.(source?.page_start ?? 1, source?.text ?? null)
    // Open sources panel if closed + highlight the matching card
    if (!expandedSources.has(index)) toggleSources(index)
    if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
    setHighlightedSourceIdx(sourceIndex)
    highlightTimerRef.current = setTimeout(() => {
      highlightTimerRef.current = null
      setHighlightedSourceIdx(null)
    }, 1500)
  },
  [expandedSources, toggleSources, index, message.sources, onOpenPdf]
)
```

- [ ] **Step 5: Update the source card "view" button**

Find this line in the source card map (around line 525):

```tsx
onClick={() => setViewerPage(pageStart as number)}
```

Replace with:

```tsx
onClick={() => onOpenPdf?.(pageStart as number, source.text ?? null)}
```

- [ ] **Step 6: Remove the iframe Dialog block**

Find and delete this entire block at the bottom of `AIMessageCard` (around lines 574–595):

```tsx
{docPublicUrl && viewerPage !== null ? (
  <Dialog open onOpenChange={() => setViewerPage(null)}>
    <DialogContent
      className="max-w-4xl overflow-hidden p-0 sm:max-h-[90vh]"
      aria-describedby={undefined}
    >
      <DialogHeader className="border-b border-border px-4 py-3">
        <DialogTitle className="text-sm font-medium">
          {message.sources.find(
            (s) => s.page_start === viewerPage
          )?.doc_name ?? (language === "ms" ? "Dokumen" : "Document")}{" "}
          — {language === "ms" ? "Halaman" : "Page"} {viewerPage}
        </DialogTitle>
      </DialogHeader>
      <iframe
        src={`${docPublicUrl}#page=${viewerPage}`}
        className="h-[75vh] w-full border-0"
        title={`Page ${viewerPage}`}
      />
    </DialogContent>
  </Dialog>
) : null}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd frontend && pnpm typecheck
```

Expected: no errors. If `ExternalLink` becomes unused after removing Dialog, remove it from imports too.

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat: add onOpenPdf prop to AIMessageCard, remove iframe Dialog"
```

---

## Task 4: Update index.tsx — split layout and wire up PDF panel

**Files:**
- Modify: `frontend/components/chat-panel/index.tsx`

> **Context:** `ChatPanel` currently returns a bare `<AiChat>`. We wrap it in a flex container and conditionally render `PdfPanel` beside (desktop) or below (mobile) the chat column. `pdfViewerState` tracks which page + highlight text to show.

- [ ] **Step 1: Add PdfPanel import**

At the top of `frontend/components/chat-panel/index.tsx`, add after the existing `./message-cards` import:

```tsx
import PdfPanel from "./pdf-panel"
```

- [ ] **Step 2: Add the pdfViewerState interface and state**

After the existing state declarations (around line 195, after `const [autoSpeak, ...]`), add:

```tsx
interface PdfViewerState {
  page: number
  highlightText: string | null
}
const [pdfViewerState, setPdfViewerState] = useState<PdfViewerState | null>(null)
```

- [ ] **Step 3: Add handleOpenPdf and handleClosePdf callbacks**

Add these after `toggleAutoSpeak` (around line 210):

```tsx
const handleOpenPdf = React.useCallback(
  (page: number, text: string | null) => {
    setPdfViewerState({ page, highlightText: text })
  },
  []
)

const handleClosePdf = React.useCallback(() => {
  setPdfViewerState(null)
}, [])
```

- [ ] **Step 4: Close the PDF panel when the selected document changes**

Find the `useEffect` that reacts to `selectedDoc` (around line 399 in `index.tsx`) — the one that begins:

```tsx
useEffect(() => {
  if (!selectedDoc) {
    setMessages([])
    ...
```

Add `setPdfViewerState(null)` as the **very first line** of that effect, before any conditional returns:

```tsx
useEffect(() => {
  setPdfViewerState(null)   // <-- add this line

  if (!selectedDoc) {
    setMessages([])
    setExpandedSources(new Set())
    setSessionId("")
    setDocumentHistory([])
    setShowHistory(false)
    return
  }
  // ...rest of effect unchanged
}, [selectedDoc])
```

> This matches the spec edge case: "Document changed (user picks new doc) → PDF panel closes".

- [ ] **Step 5: Pass onOpenPdf to AIMessageCard**

Find the `<AIMessageCard ... />` in the render (around line 1041):

```tsx
<AIMessageCard
  message={message}
  index={index}
  isLatest={index === messages.length - 1}
  expandedSources={expandedSources}
  toggleSources={toggleSources}
  copiedId={copiedId}
  copyToClipboard={copyToClipboard}
  docPublicUrl={selectedDoc?.public_url ?? undefined}
  autoSpeak={autoSpeak}
/>
```

Replace with:

```tsx
<AIMessageCard
  message={message}
  index={index}
  isLatest={index === messages.length - 1}
  expandedSources={expandedSources}
  toggleSources={toggleSources}
  copiedId={copiedId}
  copyToClipboard={copyToClipboard}
  docPublicUrl={selectedDoc?.public_url ?? undefined}
  autoSpeak={autoSpeak}
  onOpenPdf={handleOpenPdf}
/>
```

- [ ] **Step 6: Wrap the return in a split layout**

The current return (line 836) starts with:

```tsx
return (
  <AiChat
    status={chatStatus}
    className="h-full min-h-0 bg-background font-sans"
  >
```

And ends with the closing `</AiChat>`.

Replace the outer wrapper so the entire return looks like:

```tsx
const docPublicUrl = selectedDoc?.public_url ?? null
const pdfOpen = pdfViewerState !== null && !!docPublicUrl

return (
  <div className={cn("flex h-full min-h-0 bg-background", pdfOpen && "lg:flex-row")}>
    {/* Chat column */}
    <AiChat
      status={chatStatus}
      className={cn("min-w-0 font-sans", pdfOpen ? "lg:flex-1" : "h-full")}
    >
      {/* ...all the existing AiChatBody and AiChatFooter content unchanged... */}
    </AiChat>

    {/* PDF panel — desktop side column */}
    {pdfOpen && (
      <PdfPanel
        url={docPublicUrl!}
        targetPage={pdfViewerState!.page}
        highlightText={pdfViewerState!.highlightText}
        docName={selectedDoc!.name}
        documentId={selectedDoc!.id}
        language={language}
        onClose={handleClosePdf}
        className="hidden lg:flex lg:w-[420px] xl:w-[480px]"
      />
    )}

    {/* PDF panel — mobile bottom sheet */}
    {pdfOpen && (
      <PdfPanel
        url={docPublicUrl!}
        targetPage={pdfViewerState!.page}
        highlightText={pdfViewerState!.highlightText}
        docName={selectedDoc!.name}
        documentId={selectedDoc!.id}
        language={language}
        onClose={handleClosePdf}
        className="fixed inset-x-0 bottom-0 z-50 h-[60vh] border-t shadow-2xl lg:hidden"
      />
    )}
  </div>
)
```

> **Important:** Only the outer wrapper changes. Everything between `<AiChat>` and `</AiChat>` stays exactly as it was — do not modify the body or footer content inside.

- [ ] **Step 7: Verify TypeScript**

```bash
cd frontend && pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 8: Start dev server and manually verify**

```bash
pnpm dev
```

Open `http://localhost:3000/workspace` in the browser. Select a document that has a `public_url` set in Supabase. Ask a question that returns sources. Then verify:

1. Clicking a citation pill (e.g. "Hlm 12 · Section Title") opens the PDF panel on the right side of the chat (desktop).
2. The PDF opens at the correct page.
3. Text from the cited passage is highlighted in yellow.
4. Page navigation (◄ ►) works; navigating away from the cited page removes highlights.
5. Clicking a different pill updates the panel (stays open, page + highlight change).
6. Clicking "view" on a source card opens the PDF panel with the same behaviour.
7. The X button closes the panel and the chat returns to full width.
8. On mobile (resize browser to < 1024px): panel appears as a bottom sheet at 60vh.

- [ ] **Step 9: Commit**

```bash
cd ..
git add frontend/components/chat-panel/index.tsx
git commit -m "feat: split layout with PdfPanel wired to citation pill and source card clicks"
```

---

## Task 5: Add backend signed URL endpoint

**Files:**
- Modify: `backend/routers/documents.py`

> **Context:** Only needed when the Supabase bucket is **private**. The frontend tries the `public_url` first. If `Document.onLoadError` fires, `PdfPanel` fetches this endpoint and retries with the signed URL. The endpoint uses the existing `get_supabase()`, `get_bucket()`, and `get_documents_table()` helpers already present in the file.

- [ ] **Step 1: Add the signed URL endpoint**

Open `backend/routers/documents.py`. Add this function after the `delete_document` endpoint (around line 572):

```python
@router.get("/{document_id}/pdf-url")
def get_pdf_signed_url(document_id: str):
    """Return a 1-hour signed URL for the document PDF. Fallback for private buckets."""
    sb = get_supabase()
    rows = (
        sb.table(get_documents_table())
        .select("storage_path")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status_code=404, detail="Document not found")
    storage_path = rows.data[0].get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="No storage path for this document")
    result = sb.storage.from_(get_bucket()).create_signed_url(storage_path, 3600)
    return {"url": result["signedURL"], "expires_in": 3600}
```

- [ ] **Step 2: Verify the endpoint starts without import errors**

```bash
cd backend && uvicorn main:app --reload --port 8000
```

Expected: server starts, no import errors. Press Ctrl+C after confirming.

- [ ] **Step 3: Smoke-test the endpoint with a real document ID**

Use any document ID that has a `storage_path` in your Supabase table. Swap in the real ID:

```bash
curl -s http://localhost:8000/api/documents/<DOCUMENT_ID>/pdf-url | python -m json.tool
```

Expected output (structure):
```json
{
  "url": "https://....supabase.co/storage/v1/object/sign/...",
  "expires_in": 3600
}
```

If the bucket is public, `create_signed_url` still works — it just isn't needed for loading. If the document has no `storage_path` (e.g. seeded demo docs), expect a 404.

- [ ] **Step 4: Commit**

```bash
cd ..
git add backend/routers/documents.py
git commit -m "feat: add GET /api/documents/{id}/pdf-url signed URL endpoint"
```

---

## Testing Checklist

After all tasks are complete, run through this full verification:

| Scenario | Expected |
|---|---|
| Pill click → PDF panel opens | Correct page, cited text highlighted yellow |
| Different pill click (panel open) | Page + highlight update, panel stays open |
| Page navigation ◄ ► | Works; highlight only on `targetPage` |
| Scanned PDF (no text layer) | Amber banner shown; navigation still works |
| Source card "view" button | Same as pill click behaviour |
| X button closes panel | Chat returns to full width |
| Mobile (< 1024px) | Panel appears as 60vh bottom sheet |
| No public_url on doc | No PDF panel triggered; no JS errors |
| react-pdf load error | Error state shown; "Try again" retries with signed URL |
| Document switch in sidebar | PDF panel closes automatically |
