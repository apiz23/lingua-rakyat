# Public pages audit — 17 November 2026

Branch: `design/editorial-landing-refresh`

## Changes

- Restored the original Mux demo source recorded in Git history. The replacement Supabase storage URL points to a bucket that returns `NoSuchBucket`.
- Set both responsive video players to `preload="none"`. The Mux MP4 is 111,478,789 bytes; before this change, both responsive players fetched it before Play. Browser capture showed zero Mux requests before Play and successful playback after Play.
- Added the missing semantic `<main>` landmark to Results.
- Added first-focus skip links to About and Results, with focusable main targets in both pages.

## Browser audit

Production Next.js build, Chromium, English and Malay Home/About/Results at 1440, 768, 390 and 320px (24 route/viewport cases): all routes returned HTTP 200; no horizontal overflow, broken local images, missing in-page anchors or incorrect heading/landmark counts. The shared header measured 65px at 1440/768 and 106px at 390/320 on every route.

Keyboard checks confirmed that the first Tab reaches a visible skip link and Enter focuses the matching main landmark on all six routes. Language switching from Malay About to English About worked. Results renders its unavailable-metrics alert and retry action when the evaluation endpoint returns 503.

The original video responds with HTTP 200 `video/mp4`. In the production browser it reached `readyState=4`, reported a 629.83-second duration, and advanced playback after the user pressed Play. With `preload="none"`, no video requests occur before Play.

## Build and known conditions

- `pnpm build` passed, including TypeScript validation.
- Scoped ESLint passed for the public pages and changed player/navigation components.
- `git diff --check` reported no whitespace errors.
- The evaluation endpoint intentionally fails closed with HTTP 503 in `backend/routers/eval.py`; this audit leaves its authorization policy unchanged. The Results page explains that target values are not measured results.
- Local Vercel Analytics and Speed Insights requests can return 404 under `next start`. No application runtime exceptions were observed in the final route navigation check.
