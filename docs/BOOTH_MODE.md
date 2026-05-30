# BOOTH_MODE — Demo-Day Rate Limits

Quick guide to running Lingua Rakyat at a shared-WiFi booth (e.g. RISE 2026)
without hitting `HTTP 429 Too Many Requests` mid-demo.

## Why this exists

Every API route is rate-limited per client IP (`slowapi` keys by
`get_remote_address`). At a booth, **all visitors share one public WiFi IP**, so
they share one rate-limit bucket. A handful of judges asking questions at once
can drain the normal `30/minute` chat limit and start getting blocked.

`BOOTH_MODE=true` swaps every limit for a ~10× generous value for the duration
of the demo. Flip it back to `false` for normal public use.

All values live in one file: [`backend/rate_limits.py`](../backend/rate_limits.py).

## How to activate

### On Render (production demo)

1. Render dashboard → your backend service → **Environment**.
2. Add an env var:

   | Key          | Value  |
   | ------------ | ------ |
   | `BOOTH_MODE` | `true` |

3. **Save Changes** → Render redeploys automatically (~1–2 min).
4. Confirm it took effect: open `https://<your-backend>/` (health check). The
   JSON response includes `"booth_mode": true`. The startup log also prints a
   `BOOTH_MODE ENABLED` warning.

**After the event:** set `BOOTH_MODE=false` (or delete the var) and save.

### Locally

Add to `backend/.env`:

```env
BOOTH_MODE=true
```

Then restart `uvicorn`. Health check at `http://localhost:8000/` shows
`"booth_mode": true`.

## What changes

| Limit                          | Normal       | BOOTH_MODE    | Env override        |
| ------------------------------ | ------------ | ------------- | ------------------- |
| Global default (every route)   | `200/minute` | `2000/minute` | `GLOBAL_RATE_LIMIT` |
| Chat Q&A (`ask` + `ask-stream`)| `30/minute`  | `300/minute`  | `CHAT_RATE_LIMIT`   |
| Voice (STT + TTS)              | `10/minute`  | `120/minute`  | `VOICE_RATE_LIMIT`  |
| Document verify/upload/rename  | `10/minute`  | `120/minute`  | `DOC_RATE_LIMIT`    |
| Signed PDF-URL fetch           | `20/minute`  | `240/minute`  | `PDF_URL_RATE_LIMIT`|
| Seed featured docs             | `5/minute`   | `30/minute`   | `SEED_RATE_LIMIT`   |

## Fine-tuning a single limit

Any individual env override **wins over `BOOTH_MODE`**. Example — keep normal
mode everywhere but lift only the chat limit:

```env
CHAT_RATE_LIMIT=500/minute
```

Format is slowapi syntax: `<count>/<period>` where period is
`second` | `minute` | `hour` | `day`.

## Demo-day checklist

- [ ] `BOOTH_MODE=true` set on Render **before** judging starts.
- [ ] Health check (`GET /`) shows `"booth_mode": true`.
- [ ] (Optional) Voice demo planned? Confirm `VOICE_LIMIT` headroom — voice is
      the most call-heavy path.
- [ ] After the event: set `BOOTH_MODE=false`.
