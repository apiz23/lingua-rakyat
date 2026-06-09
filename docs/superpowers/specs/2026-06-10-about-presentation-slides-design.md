# About Page — Presentation Slides Design

**Date:** 2026-06-10  
**Status:** Approved

## Summary

Add a "Present" button to the About page that opens a full-screen Canva-style slideshow covering all major sections of the page. Navigate left/right, autoplay at 5s intervals, close with ESC.

---

## Visual Style

- **Outer shell:** Fixed full-screen dark overlay (viewport blackout, `rgba(0,0,0,0.9)`)
- **Slide surface:** White/off-white using app's CSS vars (`--background`, `--card`, `--border`, etc.) — matches light-mode about page aesthetic
- **Layout per slide:** Two-column — left sidebar (slide number + title + section nav dots), right content area
- **Typography:** Uses `--font-heading` (Bricolage Grotesque) + `--font-sans` (Atkinson Hyperlegible) via Tailwind classes
- **Accent:** `--primary` (deep civic green `oklch(0.38 0.13 145)`) for numbers, dots, borders, highlights
- **No AI tells:** No gradients, no glow, no purple

---

## 6 Slides

| # | Title | Content |
|---|-------|---------|
| 1 | Overview | Problem cards + Solution cards + RAG one-liner callout |
| 2 | Ingestion Pipeline | 5 steps (validation → extraction → chunking → embedding → storage) |
| 3 | Q&A Pipeline | 7 steps (lang detect → multi-query → retrieval → rerank → evidence guard → generation → post-gen) |
| 4 | Tech Stack | Backend grid (FastAPI, Groq, Cohere, Pinecone, Supabase, etc.) + Frontend grid (Next.js, Tailwind, etc.) |
| 5 | Key Features | 5 feature cards (Multilingual RAG, Evidence Guard, Voice I/O, Eval Dashboard, Doc Management) |
| 6 | Eval Metrics | 7 metric cards (ROUGE, BLEU, Faithfulness, Confidence, Semantic Sim, FK Grade, Latency) |

---

## Chrome / Controls

**Top bar:**
- Left: "Lingua Rakyat — Presentation" label
- Right: Autoplay toggle button (▶/⏸) + "5s" label + ✕ close button

**Bottom nav:**
- ← arrow (disabled on slide 1)
- Progress bar (fills proportionally)
- Slide counter "1 / 6"
- → arrow (disabled on slide 6)

**Keyboard shortcuts:**
- `←` / `ArrowLeft` — previous slide
- `→` / `ArrowRight` — next slide
- `Space` — toggle autoplay
- `Escape` — close

---

## Data Architecture

Extract all data constants from `page.tsx` into a shared `data.ts` file so both the about page and the slide component can import them without duplication.

```
frontend/app/(app)/about/
  data.ts                   ← extract: BACKEND_STACK, FRONTEND_STACK, API_ENDPOINTS,
                               EVAL_METRICS, METHOD_COLORS, KEY_FEATURES (named),
                               INGESTION_STEPS, QA_STEPS (pipeline steps lifted from inline JSX)
  page.tsx                  ← imports from data.ts, no logic change
```

---

## Component Architecture

```
frontend/components/about/
  presentation-slides.tsx   ← single client component, all 6 slides, portal to document.body
```

The component:
- Receives `open: boolean` + `onClose: () => void` props
- Renders via `createPortal` to `document.body` (ensures true full-screen over app shell)
- `useState`: `currentSlide` (0–5), `isPlaying` (default `true`)
- `useEffect` for autoplay interval (5000ms), resets on manual nav
- `useEffect` for keyboard listener (arrows, space, escape)
- Each slide is a named JSX block inside a `SLIDES` array (index maps to render)

**Button placement:** About page header area (top-right of the page header div), alongside existing badges. Uses shadcn `Button` variant `outline` with `Play` icon from lucide-react.

---

## Implementation Approach Chosen: Single Component

Three approaches were considered:
- **A (chosen): Single `presentation-slides.tsx`** — all 6 slides as JSX inside one component. Simple, self-contained, easiest to maintain for a fixed 6-slide deck.
- B: Typed data + generic renderer — cleaner separation but adds a renderer layer with multiple layout variants, overcomplicated for fixed slides.
- C: One file per slide — correct for 20+ slides, overkill here.

---

## Files Changed

1. `frontend/app/(app)/about/data.ts` — new, extracted constants
2. `frontend/app/(app)/about/page.tsx` — import from data.ts, add "Present" button
3. `frontend/components/about/presentation-slides.tsx` — new, full component
