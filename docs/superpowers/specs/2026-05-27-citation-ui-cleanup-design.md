# Citation Source Highlighting + UI Cleanup — Design Spec

**Date:** 2026-05-27  
**Status:** Approved for implementation

---

## Goal

Surface PDF source citations visually in every AI answer (no click needed to see them), and reduce UI clutter in the answer card and chat input footer on small/laptop screens.

## Architecture

**Backend changes:** None. Backend already returns full source metadata per answer:
`page_start`, `page_end`, `section_title`, `score`, `doc_name`, `document_id`.

**Frontend changes only — 2 files:**
- `frontend/components/chat-panel/message-cards.tsx`
- `frontend/components/chat-panel/index.tsx`

No new files. No API changes.

---

## Feature 1 — SourcePills Component

New sub-component in `message-cards.tsx`. Renders always-visible page badge pills below the answer text.

### Placement inside AIMessageCard

```
AIMessageCard
  ├─ badges row          (simplified — see Feature 3)
  ├─ compact evidence    (simplified — see Feature 3)
  ├─ answer text         (no change)
  ├─ [NEW] <SourcePills> ← here, only when !isStreaming && sources.length > 0
  ├─ <VoiceSpeaker>      (no change)
  ├─ footer bar          (timestamp / thumbs / sources button)
  └─ expandable sources panel (no change)
```

### Props

```typescript
interface SourcePillsProps {
  sources: SourceChunk[]
  language: string
  onPillClick: (sourceIndex: number, pageStart: number) => void
}
```

### Data processing (inside SourcePills)

1. Filter: keep only sources with `page_start` set (non-null, > 0)
2. Deduplicate by `page_start` — for each unique page, keep the source with the highest `score`
3. Sort by `page_start` ascending (document reading order)
4. Cap at 5 pills maximum

### Pill label

| message.language | page label |
|---|---|
| `"ms"` | `Hlm {page_start}` |
| `"zh-cn"` | `页 {page_start}` |
| `"en"` (default) | `Page {page_start}` |

If `page_end` exists and differs from `page_start`: use range label e.g. `Hlm 12–13`.

After the page label, append ` · {section_title}` truncated to 18 characters via CSS `max-width` + `overflow: hidden` + `text-overflow: ellipsis` + `whitespace: nowrap`.

If source has no `section_title`: omit the section part, show page only.

### Pill click handler (in AIMessageCard)

New state in `AIMessageCard`:
```typescript
const [highlightedSourceIdx, setHighlightedSourceIdx] = useState<number | null>(null)
```

New callback passed as `onPillClick`:
```typescript
const handlePillClick = useCallback(
  (sourceIndex: number, pageStart: number) => {
    // 1. Open sources panel if closed
    if (!isSourcesOpen) toggleSources(index)
    // 2. Briefly highlight the matching source card
    setHighlightedSourceIdx(sourceIndex)
    setTimeout(() => setHighlightedSourceIdx(null), 1500)
    // Note: PDF viewer not auto-opened — user clicks "view" on the highlighted
    //       source card if they want the PDF (existing behaviour, no change)
  },
  [isSourcesOpen, toggleSources, index]
)
```

### Pill styling

```tsx
// Container
<div className="mt-3 mb-1 flex flex-wrap gap-1.5">

// Each pill
<button
  type="button"
  className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/5
             px-2 py-1 text-[10px] font-medium text-primary transition-colors
             hover:border-primary/50 hover:bg-primary/10
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  onClick={() => onPillClick(sourceIndex, pageStart)}
  title={`${pageLabel} — ${sectionTitle || doc_name}`}
>
  <FileText className="h-3 w-3 shrink-0" />
  <span>{pageLabel}</span>
  {sectionTitle && (
    <span className="max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap
                     text-muted-foreground">
      · {sectionTitle}
    </span>
  )}
</button>
```

---

## Feature 2 — Source Card Highlight

When a pill is clicked, the matching source card gets a brief visual highlight.

Pass `isHighlighted={sourceIndex === highlightedSourceIdx}` when rendering each source card `<div>`.

```tsx
<div
  key={sourceIndex}
  className={cn(
    "relative border border-border/50 bg-muted/20 p-3 transition-all duration-300 ...",
    isHighlighted && "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
  )}
  // ... existing props
>
```

The transition-all + duration-300 gives a smooth colour shift. The highlight auto-clears after 1500ms via the setTimeout in handlePillClick.

---

## Feature 3 — Answer Card Badge Cleanup

### Before (6 separate badges, wraps to 2–3 lines on small screens)

```
[MS · Bahasa Melayu] [AI Assistant] [cached] [HIGH confidence] [Strong evidence] [1.2s]
```

### After (2 primary badges + 1 compact secondary line)

**Primary row** (always visible, single line):
```
[MS · Bahasa Melayu]  [▲ HIGH]            [copy button]
```

**Secondary compact line** (below primary, 1 line, 10px text):
```
● Strong evidence · cached · 1.2s · AI Assistant
```

Implementation:

```tsx
{/* Primary badges */}
<div className="mb-1.5 flex items-center justify-between gap-3">
  <div className="flex items-center gap-1.5">
    {/* Language badge — unchanged */}
    <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
      <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">{langInfo.code}</span>
      <span className="text-xs font-medium text-primary">{langInfo.name}</span>
    </div>
    {/* Confidence badge — show only if confidence > 0 */}
    {message.confidence > 0 && (
      <span className={cn("border px-2 py-0.5 text-[10px] font-medium", confidenceBadgeClass)}>
        {message.confidence_label?.toUpperCase() ?? `${Math.round(message.confidence * 100)}%`}
      </span>
    )}
  </div>
  {/* Copy button — unchanged */}
  <button ...>...</button>
</div>

{/* Secondary compact info line */}
<div className="mb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
  <span className={cn("h-1.5 w-1.5 rounded-full", evidenceState.dotColor)} />
  <span>{evidenceState.label}</span>
  {message.cached && <><span>·</span><span>cached</span></>}
  {message.latency_ms > 0 && <><span>·</span><span>{latencyLabel}</span></>}
</div>
```

### Evidence description panel — removed

Remove the full-text evidence description panel entirely (the `<div className="mb-4 border px-3 py-2 ...">` block). The compact secondary line above replaces it. This recovers ~40px per answer card on small screens.

For "Closest match only" state, the warning dot colour (amber/warning) communicates caution visually. The secondary line text still shows "Closest match only" label.

### Add `dotColor` to evidenceState object

```typescript
const evidenceState = message.sufficient_evidence
  ? {
      label: language === "ms" ? "Bukti kukuh" : "Strong evidence",
      badge: "border-success/20 bg-success/10 text-success",
      dotColor: "bg-success",
    }
  : {
      label: language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
      badge: "border-warning/20 bg-warning/10 text-warning",
      dotColor: "bg-warning",
    }
```

---

## Feature 4 — Footer Toolbar Cleanup

**Before:** 4 icon buttons in top-right: `[EN/MS] [+] [History] [⋮]`  
**After:** 3 icon buttons: `[EN/MS] [+] [⋮]`

History button removed from toolbar. Add it to the DropdownMenuContent as the first item:

```tsx
<DropdownMenuContent align="end" className="w-56">
  <DropdownMenuLabel>{copy.options}</DropdownMenuLabel>
  <DropdownMenuSeparator />

  {/* NEW — History moved here */}
  <DropdownMenuItem onClick={() => setShowHistory((prev) => !prev)}>
    <History className="mr-2 h-4 w-4" />
    {showHistory ? (language === "ms" ? "Sembunyikan sejarah" : "Hide history") : copy.history}
  </DropdownMenuItem>
  <DropdownMenuSeparator />

  {/* existing items below */}
  <DropdownMenuItem onClick={...}>Smart Retrieval</DropdownMenuItem>
  ...
</DropdownMenuContent>
```

Remove `<History className="h-4 w-4" />` standalone button from the toolbar div.

Also: in the subtitle beneath the doc name, hide the Thread label on all screens (it wraps badly). Keep only `PDF · Ready`:

```tsx
{/* Before */}
<span className="hidden min-w-0 items-center gap-2 sm:inline-flex">
  <span>·</span>
  <span>{copy.thread}: {activeThreadLabel.slice(0, 20)}</span>
</span>

{/* After — remove the thread label span entirely */}
```

---

## Feature 5 — Model Label Shortening

Add helper function in `index.tsx`:

```typescript
function shortModelLabel(modelId: string): string {
  if (!modelId) return "Auto"
  // Extract size suffix: "70b", "8b", "9b", etc.
  const sizeMatch = modelId.match(/(\d+b)/i)
  if (sizeMatch) return sizeMatch[1].toUpperCase()
  if (modelId.toLowerCase().includes("gemma")) return "Gemma"
  if (modelId.toLowerCase().includes("mixtral")) return "MoE"
  return modelId.split("-")[0].slice(0, 6)
}
```

Use in PopoverTrigger label:

```tsx
{/* Before */}
{GROQ_MODELS.find((m) => m.id === selectedPopoverModel)?.label ?? selectedPopoverModel}

{/* After */}
{shortModelLabel(selectedPopoverModel)}
```

The full label still appears inside the Popover list (no change there).

---

## Feature 6 — Auto-Baca Moves Into Input Toolbar

Remove the `<div className="mt-2 hidden justify-between ... sm:flex">` hint row entirely.

Move the Auto-baca toggle into the `<ChatInput>` children slot, alongside the model picker and mic button:

```tsx
<ChatInput ...>
  <Popover>...</Popover>

  <VoiceMicButton ... />

  {/* Auto-baca — now inside input toolbar */}
  <button
    type="button"
    onClick={toggleAutoSpeak}
    className={cn(
      "flex items-center gap-1 border px-2 py-1 text-[10px] transition-colors",
      autoSpeak
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
    )}
    title="Auto-baca jawapan"
    aria-label="Auto-baca jawapan"
    aria-pressed={autoSpeak}
  >
    <Volume2 className={cn("h-3 w-3", autoSpeak && "fill-current")} />
    <span className="hidden sm:inline">Auto-baca</span>
  </button>
</ChatInput>
```

Icon-only on mobile (text hidden below sm), icon + label on desktop.

Replace the old hint row with a minimal single line:

```tsx
{/* After — just keyboard hints, no auto-baca here */}
<p className="mt-1.5 hidden px-1 text-[10px] text-muted-foreground sm:block">
  Enter → {copy.send} · Shift+Enter → {copy.newLine}
</p>
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `message.isStreaming === true` | SourcePills not rendered |
| `sources.length === 0` | SourcePills not rendered |
| Source has no `page_start` | Source skipped in pills (still appears in expandable panel) |
| All sources same page | One pill rendered |
| `docPublicUrl` not set | Pills work normally; "view" link inside source cards already handles this (only appears when `docPublicUrl` set — no change) |
| `confidence === 0` | Confidence badge omitted from primary row |
| `model_used` empty | "AI Assistant" label omitted from secondary line |

---

## Files Changed

| File | Changes |
|---|---|
| `frontend/components/chat-panel/message-cards.tsx` | + SourcePills component, + handlePillClick, + highlightedSourceIdx state, badge cleanup, evidenceState.dotColor, source card isHighlighted styling |
| `frontend/components/chat-panel/index.tsx` | History → dropdown, thread label removed, shortModelLabel helper, Auto-baca moved into ChatInput children, hint row simplified |

---

## Testing

- SourcePills renders correct page labels in ms/en/zh-cn
- Deduplication: 3 sources from page 12 → 1 pill for page 12
- Click pill: sources panel opens, matching card gets highlight ring, highlight clears after 1500ms
- Pills absent during streaming, present after complete event
- Footer has 3 not 4 buttons; History available in dropdown
- Model label shows short alias ("70B") not full model name
- Auto-baca toggle in input toolbar, works same as before
- Evidence panel gone; secondary compact line present
- All changes responsive: laptop and mobile both clean
