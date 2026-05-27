# Citation Highlighting + UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add always-visible page-citation pills to every AI answer, and reduce clutter in the answer card badges and chat footer on small screens.

**Architecture:** Frontend-only — no backend changes. The backend already returns `page_start`, `page_end`, `section_title`, `score` per source chunk. All changes are in two files: `message-cards.tsx` (citation pills, badge cleanup, highlight) and `index.tsx` (footer toolbar, model label, auto-baca relocation).

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, lucide-react, framer-motion

---

## File Map

| File | What changes |
|---|---|
| `frontend/components/chat-panel/index.tsx` | History → dropdown, thread label removed, `shortModelLabel` helper, Auto-baca moved into ChatInput, hint row simplified |
| `frontend/components/chat-panel/message-cards.tsx` | `SourcePills` sub-component, `highlightedSourceIdx` state + handler, badge row 6→2, compact secondary info line, evidence panel removed, source card highlight ring |

No new files. No backend changes.

---

## Codebase Context

Read these files before starting any task:

- `frontend/components/chat-panel/index.tsx` — ChatPanel component. Footer toolbar has 4 right-side buttons (`[EN/MS] [+] [History] [⋮]`). ChatInput children slot has model picker Popover + VoiceMicButton. Below ChatInput: a `hidden sm:flex` row with "Enter → Send" hint and Auto-baca toggle.
- `frontend/components/chat-panel/message-cards.tsx` — AIMessageCard component. Badge row renders up to 6 badges (language, AI label, cached, confidence, evidence, latency). Evidence panel is a full-text description block. Source cards are in an expandable `AnimatePresence` section. `VoiceSpeaker` renders after answer text.

Types you'll use:
```typescript
// from @/lib/api (already imported in both files)
interface SourceChunk {
  text: string
  document_id: string
  score: number
  doc_name: string
  page_start: number | null
  page_end: number | null
  section_title: string
  vector_score: number
  rerank_score: number
  confidence_label: string
}
```

---

## Task 1: Footer Toolbar Cleanup + Model Label

**Files:**
- Modify: `frontend/components/chat-panel/index.tsx`

### Step 1: Add `shortModelLabel` helper before the component

- [ ] In `frontend/components/chat-panel/index.tsx`, find the line `interface ChatPanelProps {` and insert this function **above** it:

```typescript
function shortModelLabel(modelId: string): string {
  if (!modelId) return "Auto"
  const sizeMatch = modelId.match(/(\d+b)/i)
  if (sizeMatch) return sizeMatch[1].toUpperCase()
  if (modelId.toLowerCase().includes("gemma")) return "Gemma"
  if (modelId.toLowerCase().includes("mixtral")) return "MoE"
  return modelId.split("-")[0].slice(0, 6)
}
```

### Step 2: Move History into the dropdown menu

- [ ] In the `<DropdownMenuContent align="end" className="w-56">` block, replace the existing content with a version that has History as the first item. Find:

```tsx
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{copy.options}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setEnableQueryAugmentation((prev) => !prev)}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {enableQueryAugmentation ? copy.smartOff : copy.smartOn}
                  </DropdownMenuItem>
```

Replace with:

```tsx
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{copy.options}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setShowHistory((prev) => !prev)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {showHistory
                      ? language === "ms"
                        ? "Sembunyikan sejarah"
                        : "Hide history"
                      : copy.history}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setEnableQueryAugmentation((prev) => !prev)}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {enableQueryAugmentation ? copy.smartOff : copy.smartOn}
                  </DropdownMenuItem>
```

### Step 3: Remove the standalone History button from the toolbar

- [ ] Find and remove the standalone History button. Find:

```tsx
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className={cn(
                  "p-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                  showHistory
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={copy.history}
              >
                <History className="h-4 w-4" />
              </button>
```

Delete that entire button block (7 lines including the closing `</button>`).

### Step 4: Shorten the model label in the PopoverTrigger

- [ ] Find the PopoverTrigger button label. Find:

```tsx
                  {selectedPopoverModel
                    ? (GROQ_MODELS.find(
                        (model) => model.id === selectedPopoverModel
                      )?.label ?? selectedPopoverModel)
                    : copy.autoServer}
```

Replace with:

```tsx
                  {shortModelLabel(selectedPopoverModel)}
```

### Step 5: Remove Thread label from the doc subtitle

- [ ] Find and remove the Thread suffix in the subtitle. Find:

```tsx
                      <span className="hidden min-w-0 items-center gap-2 sm:inline-flex">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <span className="truncate">
                          {copy.thread}: {activeThreadLabel.slice(0, 20)}
                        </span>
                      </span>
```

Delete that entire `<span>` block.

### Step 6: Type-check

- [ ] Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

### Step 7: Verify in browser

- [ ] Run `cd frontend && npm run dev`, open the app, select a document.
- Verify: Footer toolbar has **3** right-side buttons (EN/MS, +, ⋮).
- Click ⋮ → verify History item appears at the top of the dropdown.
- Verify: model label shows short form ("70B", "8B", or "Auto"), not the full model name.
- Verify: subtitle shows "PDF · Ready" only, no thread label.

### Step 8: Commit

- [ ] Run:
```bash
git add frontend/components/chat-panel/index.tsx
git commit -m "feat: footer cleanup — history in dropdown, short model label, remove thread subtitle"
```

---

## Task 2: Auto-baca Relocation

**Files:**
- Modify: `frontend/components/chat-panel/index.tsx`

### Step 1: Add Auto-baca button inside ChatInput children

- [ ] Find the ChatInput block. Find:

```tsx
            <ChatInput
              value={input}
              onChange={setInput}
              ref={inputRef}
              onSubmit={submitQuestion}
              loading={loading}
              disabled={
                !selectedDoc || !sessionId || !userId || rateLimitedUntil !== null
              }
              placeholder={
                rateLimitedUntil !== null
                  ? `${copy.waitAgain} ${rateLimitSecondsLeft}s...`
                  : selectedDoc
                    ? copy.askPlaceholder
                    : "Select a document to start..."
              }
              className="bg-card"
            >
              <Popover>
```

The ChatInput's children end before `</ChatInput>`. Find the closing of the children section — the `<VoiceMicButton ... />` line — and add the Auto-baca button after it. Find:

```tsx
            <VoiceMicButton
              disabled={loading}
              onTranscript={(text, _language) => setInput(text)}
              onError={(msg) => toast.error(msg)}
              titleIdle={copy.voiceStart}
              titleRecording={copy.voiceStop}
            />
          </ChatInput>
```

Replace with:

```tsx
            <VoiceMicButton
              disabled={loading}
              onTranscript={(text, _language) => setInput(text)}
              onError={(msg) => toast.error(msg)}
              titleIdle={copy.voiceStart}
              titleRecording={copy.voiceStop}
            />

            <button
              type="button"
              onClick={toggleAutoSpeak}
              className={cn(
                "flex items-center gap-1 border px-2 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                autoSpeak
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
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

### Step 2: Replace the old hint row

- [ ] Find and replace the old hint/auto-baca row. Find:

```tsx
          <div className="mt-2 hidden justify-between px-2 sm:mt-3 sm:flex">
            <p className="text-xs text-muted-foreground">Enter {copy.send}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAutoSpeak}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  autoSpeak ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                title="Auto-baca jawapan"
                aria-label="Auto-baca jawapan"
                aria-pressed={autoSpeak}
              >
                <Volume2 className={cn("h-3 w-3", autoSpeak && "fill-current")} />
                Auto-baca
              </button>
              <p className="text-xs text-muted-foreground">
                Shift + Enter {copy.newLine}
              </p>
            </div>
          </div>
```

Replace with:

```tsx
          <p className="mt-1.5 hidden px-1 text-[10px] text-muted-foreground sm:block">
            Enter → {copy.send} · Shift+Enter → {copy.newLine}
          </p>
```

### Step 3: Type-check

- [ ] Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

### Step 4: Verify in browser

- [ ] Run `cd frontend && npm run dev`, open the app, select a document.
- Verify: Auto-baca button is **inside** the input box (bottom-left area, next to mic).
- Verify: Icon-only on narrow window; text "Auto-baca" visible at wider widths.
- Toggle Auto-baca: button should turn green when on, grey when off.
- Verify: below the input box there is only one line: "Enter → Send · Shift+Enter → New line" (no second row).

### Step 5: Commit

- [ ] Run:
```bash
git add frontend/components/chat-panel/index.tsx
git commit -m "feat: move auto-baca into input toolbar, simplify hint row"
```

---

## Task 3: Answer Card Badge Cleanup

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

### Step 1: Add `cn` import

- [ ] At the top of `frontend/components/chat-panel/message-cards.tsx`, add `cn` to imports. Find:

```typescript
import React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { SourceChunk } from "@/lib/api"
```

Replace with:

```typescript
import React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { SourceChunk } from "@/lib/api"
```

### Step 2: Update `evidenceState` — add `dotColor`, remove `panel` and `description`

- [ ] In `AIMessageCard`, find:

```typescript
  const evidenceState = message.sufficient_evidence
    ? {
        label: language === "ms" ? "Bukti kukuh" : "Strong evidence",
        badge: "border-success/20 bg-success/10 text-success",
        panel: "border-success/20 bg-success/5 text-success",
        description:
          language === "ms"
            ? "Jawapan ini disokong terus oleh kandungan dokumen yang dimuat naik."
            : "This answer is directly supported by the uploaded document.",
      }
    : {
        label:
          language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
        badge: "border-warning/20 bg-warning/10 text-warning",
        panel: "border-warning/20 bg-warning/5 text-warning",
        description:
          language === "ms"
            ? "Dokumen tidak mempunyai bukti yang cukup kuat, jadi pembantu menggunakan jawapan selamat tanpa membuat andaian."
            : "The document did not contain strong enough evidence, so the assistant used a safe fallback instead of guessing.",
      }
```

Replace with:

```typescript
  const evidenceState = message.sufficient_evidence
    ? {
        label: language === "ms" ? "Bukti kukuh" : "Strong evidence",
        dotColor: "bg-success",
      }
    : {
        label:
          language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
        dotColor: "bg-warning",
      }
```

### Step 3: Replace the 6-badge primary row with 2-badge row + compact secondary line

- [ ] Find the entire badge header block (from the outer `<div className="mb-4 flex items-start ...">` down to and including the copy button `</button>`):

```tsx
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
                  <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">
                    {langInfo.code}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {langInfo.name}
                  </span>
                </div>

                <span className="bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground sm:text-xs">
                  {language === "ms" ? "Pembantu AI" : "AI Assistant"}
                </span>

                {message.cached ? (
                  <span className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    cached
                  </span>
                ) : null}

                {message.confidence > 0 ? (
                  <span
                    className={[
                      "border px-2 py-0.5 text-[10px] font-medium",
                      message.confidence >= 0.75
                        ? "border-success/20 bg-success/10 text-success"
                        : message.confidence >= 0.5
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-warning/20 bg-warning/10 text-warning",
                    ].join(" ")}
                  >
                    {message.confidence_label
                      ? message.confidence_label.toUpperCase()
                      : `${Math.round(message.confidence * 100)}%`}{" "}
                    {language === "ms" ? "keyakinan" : "confidence"}
                  </span>
                ) : null}

                <span
                  className={[
                    "border px-2 py-0.5 text-[10px] font-medium",
                    evidenceState.badge,
                  ].join(" ")}
                >
                  {evidenceState.label}
                </span>

                {message.latency_ms > 0 ? (
                  <span className="border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() =>
                  copyToClipboard(message.answer, `a-${message.timestamp}`)
                }
                className="p-1.5 opacity-100 transition-colors group-hover:opacity-100 hover:bg-muted sm:opacity-0"
                title="Copy answer"
              >
                {copiedId === `a-${message.timestamp}` ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
```

Replace with:

```tsx
            {/* Primary row: 2 essential badges + copy button */}
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
                  <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">
                    {langInfo.code}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {langInfo.name}
                  </span>
                </div>

                {message.confidence > 0 ? (
                  <span
                    className={[
                      "border px-2 py-0.5 text-[10px] font-medium",
                      message.confidence >= 0.75
                        ? "border-success/20 bg-success/10 text-success"
                        : message.confidence >= 0.5
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-warning/20 bg-warning/10 text-warning",
                    ].join(" ")}
                  >
                    {message.confidence_label
                      ? message.confidence_label.toUpperCase()
                      : `${Math.round(message.confidence * 100)}%`}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() =>
                  copyToClipboard(message.answer, `a-${message.timestamp}`)
                }
                className="p-1.5 opacity-100 transition-colors group-hover:opacity-100 hover:bg-muted sm:opacity-0"
                title="Copy answer"
              >
                {copiedId === `a-${message.timestamp}` ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Compact secondary line: evidence dot + label + cached + latency */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", evidenceState.dotColor)} />
              <span>{evidenceState.label}</span>
              {message.cached ? (
                <>
                  <span>·</span>
                  <span>{language === "ms" ? "cache" : "cached"}</span>
                </>
              ) : null}
              {message.latency_ms > 0 ? (
                <>
                  <span>·</span>
                  <span>
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                </>
              ) : null}
            </div>
```

### Step 4: Remove the evidence description panel

- [ ] Find and delete the evidence panel div. Find:

```tsx
            <div
              className={[
                "mb-4 border px-3 py-2 text-xs leading-relaxed",
                evidenceState.panel,
              ].join(" ")}
            >
              {evidenceState.description}
            </div>
```

Delete that entire block (6 lines).

### Step 5: Type-check

- [ ] Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors. (If TS complains about `evidenceState.badge` or `evidenceState.panel` still being referenced somewhere, find and remove those references.)

### Step 6: Verify in browser

- [ ] Run dev server, ask a question about a document.
- Verify: Answer card shows exactly **2 badges** on primary row: language + confidence (if confidence > 0).
- Verify: Compact secondary line shows e.g. `● Strong evidence · 1.2s` (green dot for strong, amber for closest-match).
- Verify: The large evidence description paragraph is **gone**.
- Ask a question that returns "Closest match only" (try an off-topic question) — verify amber dot + "Closest match only" text in secondary line.

### Step 7: Commit

- [ ] Run:
```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat: simplify answer card badges — 2 primary badges + compact info line"
```

---

## Task 4: SourcePills Component + Source Card Highlight

**Files:**
- Modify: `frontend/components/chat-panel/message-cards.tsx`

### Step 1: Add the `SourcePills` sub-component

- [ ] In `frontend/components/chat-panel/message-cards.tsx`, find the line `export function AIMessageCard(` and insert the following **above** it (after the `highlightSourceText` function):

```tsx
// ---------------------------------------------------------------------------
// SourcePills — always-visible page citation badges below the answer
// ---------------------------------------------------------------------------

interface SourcePillData {
  pageStart: number
  pageEnd: number | null
  sectionTitle: string
  sourceIndex: number
}

function SourcePills({
  sources,
  language,
  onPillClick,
}: {
  sources: SourceChunk[]
  language: string
  onPillClick: (sourceIndex: number, pageStart: number) => void
}) {
  // Deduplicate by page_start — keep highest-scoring source per page
  const pillMap = new Map<number, SourcePillData>()
  sources.forEach((source, idx) => {
    const page = source.page_start
    if (!page) return
    const existing = pillMap.get(page)
    if (!existing || source.score > (sources[existing.sourceIndex]?.score ?? 0)) {
      pillMap.set(page, {
        pageStart: page,
        pageEnd: source.page_end ?? null,
        sectionTitle: source.section_title ?? "",
        sourceIndex: idx,
      })
    }
  })

  // Sort by page_start ascending (document reading order), cap at 5
  const pills = Array.from(pillMap.values())
    .sort((a, b) => a.pageStart - b.pageStart)
    .slice(0, 5)

  if (pills.length === 0) return null

  const pageLabel = (pill: SourcePillData): string => {
    const range =
      pill.pageEnd && pill.pageEnd !== pill.pageStart
        ? `${pill.pageStart}–${pill.pageEnd}`
        : `${pill.pageStart}`
    if (language === "ms") return `Hlm ${range}`
    if (language === "zh-cn") return `页 ${range}`
    return `Page ${range}`
  }

  return (
    <div className="mt-3 mb-1 flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <button
          key={pill.pageStart}
          type="button"
          onClick={() => onPillClick(pill.sourceIndex, pill.pageStart)}
          className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={pill.sectionTitle || pageLabel(pill)}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span>{pageLabel(pill)}</span>
          {pill.sectionTitle ? (
            <span className="max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
              · {pill.sectionTitle}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
```

### Step 2: Add `highlightedSourceIdx` state and `handlePillClick` to `AIMessageCard`

- [ ] Inside `AIMessageCard`, after the existing `const [viewerPage, setViewerPage] = React.useState<number | null>(null)` line, add:

```typescript
  const [highlightedSourceIdx, setHighlightedSourceIdx] = React.useState<number | null>(null)

  const handlePillClick = React.useCallback(
    (sourceIndex: number, _pageStart: number) => {
      // Open sources panel if closed — use expandedSources (not isSourcesOpen) to avoid stale closure
      if (!expandedSources.has(index)) toggleSources(index)
      // Briefly highlight the matching source card
      setHighlightedSourceIdx(sourceIndex)
      setTimeout(() => setHighlightedSourceIdx(null), 1500)
    },
    [expandedSources, toggleSources, index]
  )
```

### Step 3: Render `SourcePills` inside the answer card

- [ ] Find the `<VoiceSpeaker>` line:

```tsx
            {!message.isStreaming && (
              <VoiceSpeaker text={message.answer} language={message.language} />
            )}
```

Insert `<SourcePills>` **above** it:

```tsx
            {!message.isStreaming && message.sources.length > 0 && (
              <SourcePills
                sources={message.sources}
                language={message.language}
                onPillClick={handlePillClick}
              />
            )}

            {!message.isStreaming && (
              <VoiceSpeaker text={message.answer} language={message.language} />
            )}
```

### Step 4: Add highlight ring to source cards

- [ ] In the sources map, find the source card `<div>`:

```tsx
                        <div
                          key={sourceIndex}
                          className="animate-in fade-in slide-in-from-top-1 relative border border-border/50 bg-muted/20 p-3 transition-colors duration-200 hover:bg-muted/40 sm:p-4"
                          style={{ animationDelay: `${sourceIndex * 50}ms` }}
                        >
```

Replace with:

```tsx
                        <div
                          key={sourceIndex}
                          className={cn(
                            "animate-in fade-in slide-in-from-top-1 relative border p-3 transition-all duration-300 sm:p-4",
                            highlightedSourceIdx === sourceIndex
                              ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/50 bg-muted/20 hover:bg-muted/40"
                          )}
                          style={{ animationDelay: `${sourceIndex * 50}ms` }}
                        >
```

### Step 5: Type-check

- [ ] Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

### Step 6: Verify in browser — citation pills appear

- [ ] Run dev server, select a document, ask a question.
- Verify: After the answer streams in, page pills appear below the answer text (e.g. `📄 Page 12 · Kadar Caruman`).
- Verify: Pills are ordered by page number (ascending).
- Verify: Multiple sources from the same page → only **one** pill for that page.
- Verify: At most 5 pills regardless of how many sources there are.
- Verify: Pills are hidden while the answer is streaming (`isStreaming === true`).
- Verify: A message with 0 sources shows no pills.

### Step 7: Verify in browser — pill click behaviour

- [ ] Click a pill.
- Verify: Sources panel **opens** (if it was closed).
- Verify: The matching source card gets a green ring/border highlight.
- Verify: The highlight **fades** after ~1.5 seconds.
- Verify: If sources panel was already open, it stays open; only the highlight appears.

### Step 8: Verify multilingual labels

- [ ] Ask a question in Malay (e.g. "ringkaskan dokumen ini").
- Verify: Pills show `Hlm 12` (not "Page 12").
- [ ] If Chinese is available, ask in Chinese.
- Verify: Pills show `页 12`.

### Step 9: Commit

- [ ] Run:
```bash
git add frontend/components/chat-panel/message-cards.tsx
git commit -m "feat: add SourcePills citation badges + source card highlight"
```

---

## Final Integration Check

### Step 1: Full visual review

- [ ] Run the app, open a document, ask 3 different questions (one in English, one in Malay, one summary request).

For each answer verify:
- [ ] Answer card: 2 primary badges (language + confidence), compact secondary line (dot + evidence label + latency), no large evidence paragraph
- [ ] Citation pills appear below answer, correct page numbers, truncated section title
- [ ] Footer: 3 icon buttons only (EN/MS, +, ⋮)
- [ ] Model label is short ("70B", "8B", or "Auto")
- [ ] Auto-baca toggle is inside the input box
- [ ] Keyboard hint line is single row

### Step 2: Regression check — existing features still work

- [ ] Sources panel expands/collapses as before when clicking "N sources" button
- [ ] PDF viewer dialog opens when clicking "view" on a source card (if `public_url` is set)
- [ ] Voice mic button still works (transcription fills input)
- [ ] Voice speaker button still works (TTS plays)
- [ ] History panel still opens via ⋮ dropdown → History
- [ ] New chat button (+) creates a new session
- [ ] Smart retrieval toggle still works in ⋮ dropdown
- [ ] Export history still works in ⋮ dropdown

### Step 3: TypeScript final check

- [ ] Run:
```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors.

### Step 4: Final commit tag

- [ ] Run:
```bash
git tag feat/citation-ui-cleanup-complete
```

---

## Spec Reference

Full design spec: `docs/superpowers/specs/2026-05-27-citation-ui-cleanup-design.md`
