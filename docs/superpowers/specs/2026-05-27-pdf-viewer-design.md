# PDF Viewer with Passage Highlight — Design Spec

**Date:** 2026-05-27  
**Status:** Approved for implementation

---

## Goal

Open the source PDF beside the chat when a citation pill is clicked, and highlight the exact passage that was cited — giving visual proof that the AI answer came directly from the document.

---

## Architecture

**Frontend changes — 3 files modified, 1 new:**
- `frontend/components/chat-panel/pdf-panel.tsx` ← new
- `frontend/components/chat-panel/index.tsx`
- `frontend/components/chat-panel/message-cards.tsx`
- `frontend/next.config.ts`

**Backend change — 1 endpoint added:**
- `backend/routers/documents.py` — `GET /api/documents/{id}/pdf-url`

**New dependency:**
- `react-pdf` v9 (PDF.js wrapper for React, supports React 18 + Next.js 14)

---

## Data Flow

```
User clicks citation pill (e.g. "Hlm 12 · Kadar Caruman")
  → handlePillClick(sourceIndex, pageStart) in AIMessageCard
  → onOpenPdf(page_start, sources[sourceIndex].text) called
  → pdfViewerState set in ChatPanel: { page: 12, highlightText: "Kadar caruman pekerja ialah 11%..." }
  → PdfPanel renders at page 12
  → customTextRenderer highlights words from source.text in PDF text layer
  → Sources panel also opens + source card highlighted (existing behaviour preserved)
```

User clicks "view" on a source card → same flow as pill click.

---

## Feature 1 — PdfPanel Component

**File:** `frontend/components/chat-panel/pdf-panel.tsx` (new)

### Props

```typescript
interface PdfPanelProps {
  url: string                    // Supabase public_url (or signed URL)
  targetPage: number             // Page to open immediately
  highlightText: string | null   // source.text from the chunk — used for highlighting
  docName: string                // Shown in panel header
  language: string               // "ms" | "en" | "zh-cn"
  onClose: () => void
  className?: string
}
```

### Internal state

```typescript
const [numPages, setNumPages] = useState<number | null>(null)
const [currentPage, setCurrentPage] = useState(targetPage)
const [hasTextLayer, setHasTextLayer] = useState<boolean | null>(null)  // null = unknown
const [loadError, setLoadError] = useState(false)
```

When `targetPage` prop changes (user clicks a different pill), `currentPage` updates to match.

### Text highlighting

Uses `react-pdf`'s `customTextRenderer` prop on the `Page` component:

```typescript
// highlightText is only applied when rendering the targetPage.
// When the user navigates away from targetPage, pass null to suppress highlights.
const activeHighlight = currentPage === targetPage ? highlightText : null

const customTextRenderer = useCallback(
  ({ str }: { str: string }) => {
    if (!activeHighlight || str.trim().length < 3) return str
    const inChunk = activeHighlight.toLowerCase().includes(str.toLowerCase().trim())
    if (inChunk) return `<mark class="pdf-hl">${str}</mark>`
    return str
  },
  [activeHighlight]
)
```

CSS for the highlight mark (in `globals.css` or inline style):
```css
.pdf-hl {
  background: oklch(0.85 0.15 85 / 0.65);
  padding: 1px 0;
  border-radius: 2px;
}
```

### Scanned PDF detection

```typescript
<Page
  pageNumber={currentPage}
  customTextRenderer={customTextRenderer}
  onGetTextSuccess={(textContent) => {
    setHasTextLayer(textContent.items.length > 0)
  }}
  renderTextLayer={true}
  renderAnnotationLayer={false}
/>
```

`onGetTextSuccess` fires after the text layer is extracted. If `items.length === 0`, the PDF is image-only (scanned) — no text to highlight.

### Scanned PDF banner

When `hasTextLayer === false` and `highlightText !== null`:

```tsx
<div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
  <span>
    {language === "ms"
      ? "Penyerlahan teks tidak tersedia untuk dokumen imbasan."
      : "Text highlighting unavailable for scanned documents."}
  </span>
</div>
```

Import `AlertTriangle` from `lucide-react`.

### Layout structure

```tsx
<div className={cn("flex flex-col border-l border-border bg-background", className)}>
  {/* Header */}
  <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
    <span className="truncate text-xs font-medium text-foreground">{docName}</span>
    <button onClick={onClose} aria-label="Close PDF viewer">
      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
    </button>
  </div>

  {/* Scanned banner — conditional */}
  {hasTextLayer === false && highlightText && <ScannedBanner />}

  {/* PDF canvas — scrollable */}
  <div className="flex-1 overflow-y-auto bg-[#525659]">
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      onLoadError={() => setLoadError(true)}
      loading={<PdfLoadingSpinner />}
      error={<PdfErrorState onRetry={() => setLoadError(false)} />}
    >
      <Page
        pageNumber={currentPage}
        width={panelWidth - 24}   // panelWidth from ResizeObserver on container
        customTextRenderer={customTextRenderer}
        onGetTextSuccess={...}
        renderTextLayer={true}
        renderAnnotationLayer={false}
        loading={<PageLoadingPlaceholder />}
      />
    </Document>
  </div>

  {/* Footer — page navigation */}
  <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-3">
    <button
      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
      disabled={currentPage <= 1}
      aria-label="Previous page"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
    <span className="text-[11px] text-muted-foreground">
      {language === "ms" ? "Halaman" : "Page"} {currentPage}
      {numPages ? ` / ${numPages}` : ""}
    </span>
    <button
      onClick={() => setCurrentPage((p) => Math.min(numPages ?? p, p + 1))}
      disabled={numPages !== null && currentPage >= numPages}
      aria-label="Next page"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
</div>
```

### Panel width

Use a `ResizeObserver` ref on the panel container to get the rendered width, pass to `Page` as `width`. This ensures the PDF fills the panel regardless of screen size.

```typescript
const containerRef = useRef<HTMLDivElement>(null)
const [panelWidth, setPanelWidth] = useState(420)

useEffect(() => {
  if (!containerRef.current) return
  const ro = new ResizeObserver(([entry]) => {
    setPanelWidth(entry.contentRect.width)
  })
  ro.observe(containerRef.current)
  return () => ro.disconnect()
}, [])
```

### Loading and error states

**Loading (PDF document):**
```tsx
function PdfLoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
```

**Error:**
```tsx
function PdfErrorState({ language, onRetry }: { language: string; onRetry: () => void }) {
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
```

---

## Feature 2 — Split Layout in ChatPanel

**File:** `frontend/components/chat-panel/index.tsx`

### New state

```typescript
interface PdfViewerState {
  page: number
  highlightText: string | null
}

const [pdfViewerState, setPdfViewerState] = useState<PdfViewerState | null>(null)
```

### `onOpenPdf` callback

```typescript
const handleOpenPdf = useCallback((page: number, text: string | null) => {
  setPdfViewerState({ page, highlightText: text })
}, [])

const handleClosePdf = useCallback(() => {
  setPdfViewerState(null)
}, [])
```

### Split layout wrapper

Replace the outer `<AiChat>` wrapper with:

```tsx
const docPublicUrl = selectedDoc?.public_url ?? null
const pdfOpen = pdfViewerState !== null && !!docPublicUrl

<div className={cn(
  "flex h-full min-h-0 bg-background",
  pdfOpen && "lg:flex-row"
)}>
  {/* Chat column */}
  <AiChat
    status={chatStatus}
    className={cn("min-w-0 font-sans", pdfOpen ? "lg:flex-1" : "h-full")}
  >
    ...existing chat body and footer...
  </AiChat>

  {/* PDF panel — desktop side column */}
  {pdfOpen && (
    <PdfPanel
      url={docPublicUrl!}
      targetPage={pdfViewerState!.page}
      highlightText={pdfViewerState!.highlightText}
      docName={selectedDoc!.name}
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
      language={language}
      onClose={handleClosePdf}
      className="lg:hidden fixed inset-x-0 bottom-0 z-50 h-[60vh] border-t shadow-2xl"
    />
  )}
</div>
```

### Pass `onOpenPdf` to AIMessageCard

```tsx
<AIMessageCard
  ...existing props...
  onOpenPdf={handleOpenPdf}
/>
```

---

## Feature 3 — AIMessageCard Wired to PDF Panel

**File:** `frontend/components/chat-panel/message-cards.tsx`

### New prop

Add to `AIMessageCard` props:
```typescript
onOpenPdf?: (page: number, text: string | null) => void
```

### Updated `handlePillClick`

```typescript
const handlePillClick = React.useCallback(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (sourceIndex: number, _pageStart: number) => {
    const source = message.sources[sourceIndex]
    // Open PDF panel with the source text for highlighting
    onOpenPdf?.(source.page_start ?? 1, source.text ?? null)
    // Also open sources panel + highlight card (existing behaviour preserved)
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

### Updated source card "view" button

Replace the existing `setViewerPage` call:
```typescript
// Before
onClick={() => setViewerPage(pageStart as number)}

// After
onClick={() => onOpenPdf?.(pageStart as number, source.text ?? null)}
```

### Remove iframe Dialog

Remove the entire block at the bottom of `AIMessageCard`:
```tsx
{docPublicUrl && viewerPage !== null ? (
  <Dialog open onOpenChange={() => setViewerPage(null)}>
    ...
  </Dialog>
) : null}
```

Remove `viewerPage` state declaration. Remove `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` imports if no longer used elsewhere.

---

## Feature 4 — Next.js Webpack Config

**File:** `frontend/next.config.ts`

```typescript
import type { NextConfig } from "next"
import CopyPlugin from "copy-webpack-plugin"

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // react-pdf / PDF.js: disable canvas (not needed for text rendering)
    config.resolve.alias.canvas = false

    // Copy PDF.js worker to public directory so it loads at runtime
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

export default nextConfig
```

Install `copy-webpack-plugin` as a dev dependency:
```bash
npm install -D copy-webpack-plugin
```

In `pdf-panel.tsx`, set the worker source once (top of file, outside component):
```typescript
import { pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
```

---

## Feature 5 — Backend Signed URL Endpoint

**File:** `backend/routers/documents.py`

Only needed when Supabase bucket is **private**. If `public_url` loads successfully in react-pdf, this endpoint is not called. The frontend uses it as a fallback.

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

Frontend usage (in `pdf-panel.tsx`) — only if initial load fails. Uses `API_URL` from `@/lib/api`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// If Document onLoadError fires, fetch signed URL and retry once
const fetchSignedUrl = async () => {
  const res = await fetch(`${API_URL}/api/documents/${documentId}/pdf-url`)
  const { url } = await res.json()
  setResolvedUrl(url)
}
```

Add `documentId` to `PdfPanelProps` so the fallback fetch can reference it:
```typescript
documentId: string   // add to PdfPanelProps
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `public_url` null / not set | PDF panel button/pills do not trigger viewer; "view" buttons on source cards hidden |
| Scanned PDF (no text layer) | Panel opens, page navigation works, amber banner shown |
| `highlightText` matches nothing on page | Page opens, no highlights — no error |
| User navigates to different page manually | Highlight only shown when `currentPage === targetPage`; other pages render without highlights |
| Pill clicked while panel already open | `targetPage` updates, panel stays open, new highlight shown |
| `react-pdf` load error on `public_url` | Error state shown + "Try again" retries with signed URL |
| Mobile with PDF open | Bottom sheet at 60vh, X button closes |
| Document changed (user picks new doc) | PDF panel closes (`pdfViewerState` reset in existing `selectedDoc` useEffect) |

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/chat-panel/pdf-panel.tsx` | NEW — react-pdf panel component |
| `frontend/components/chat-panel/index.tsx` | Split layout, pdfViewerState, onOpenPdf |
| `frontend/components/chat-panel/message-cards.tsx` | onOpenPdf prop, pill/source card wiring, remove iframe Dialog |
| `frontend/next.config.ts` | canvas alias + CopyPlugin for PDF.js worker |
| `backend/routers/documents.py` | Add `GET /{id}/pdf-url` signed URL endpoint |

---

## Testing

- Pill click → PDF panel opens at correct page, cited text highlighted in yellow
- Clicking different pill → panel updates page + highlight (stays open)
- Page navigation (◄ ►) works; manual navigation to different page clears highlight
- Scanned PDF → amber banner shown, page navigation still works
- Source card "view" button → same behaviour as pill
- X button closes panel; layout returns to full-width chat
- Mobile: panel appears as 60vh bottom sheet
- No `public_url` set → no PDF panel triggers, no errors
- `react-pdf` load error → error state shown, signed URL retry
- Document switch → panel closes automatically
