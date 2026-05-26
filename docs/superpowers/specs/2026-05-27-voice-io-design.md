# Voice I/O — Design Spec
**Date:** 2026-05-27  
**Project:** Lingua Rakyat  
**Status:** Approved

---

## 1. Overview

Add bilingual voice input/output to Lingua Rakyat's chat interface. Users speak their question (in BM, EN, or ZH) into a mic button; the transcribed text flows into the existing RAG pipeline unchanged; the AI answer is read back aloud via ElevenLabs TTS with a Web Speech API fallback.

Voice is a thin layer on top of the existing system — the RAG pipeline, chat router, and evaluation system are untouched.

---

## 2. Scope

**In scope:**
- Browser microphone recording (MediaRecorder API)
- STT: Groq Whisper `whisper-large-v3` via new backend endpoint
- TTS: ElevenLabs `eleven_multilingual_v2` via new backend endpoint
- Fallback: `window.speechSynthesis` when ElevenLabs quota is exceeded
- Inline mic button in chat input bar (4 states: idle / recording / transcribing / done)
- Inline 🔊 "Dengar Jawapan" play button under each AI answer bubble
- Auto-speak toggle (off by default)
- Error toasts for mic permission denial, short recordings, transcription failure

**Out of scope:**
- Voice activity detection (VAD) / silence auto-stop
- Streaming TTS (Approach 2 — future upgrade)
- Voice-first loop mode (Approach 3 — future feature)
- ElevenLabs `@elevenlabs/react` SDK (designed for their hosted agents, not our RAG pipeline)
- Mobile / WhatsApp integration

---

## 3. Architecture

```
Frontend                          Backend                    External
─────────────────────────────     ──────────────────────     ──────────────
useVoiceRecorder hook
  MediaRecorder → WebM/Opus blob
  → POST /api/voice/transcribe ──────────────────────────>
                                  Groq Whisper large-v3
  <── { transcript, language } ──────────────────────────

  fills chat textarea (user presses Send manually)
  → POST /api/chat/ask (unchanged)
  <── { answer, language, ... }

  VoiceSpeaker button appears
  user clicks 🔊
  → POST /api/voice/tts ─────────────────────────────────>
                                  ElevenLabs multilingual v2
                                  voice_id from ELEVENLABS_VOICE_ID
  <── audio/mpeg blob ───────────────────────────────────
      OR { "fallback": true } if 429

  if blob   → <audio>.play()
  if fallback → window.speechSynthesis.speak()
```

**Key constraint:** `/api/chat/ask` is not modified. Voice is additive only.

---

## 4. Backend

### 4.1 New file: `routers/voice.py`

Two endpoints, rate-limited to 10 req/min per IP.

#### `POST /api/voice/transcribe`
- **Input:** `multipart/form-data` — field `audio` (WebM/Opus file, max 25MB)
- **Output:** `{ "transcript": str, "language": str, "duration_s": float }`
- **Logic:**
  1. Validate file size > 0, duration > 0.5s (reject with 400 if too short)
  2. Call Groq: `client.audio.transcriptions.create(model="whisper-large-v3", file=audio_file, response_format="verbose_json")`
  3. Extract `text` and `language` from Groq response
  4. Return transcript + detected language

#### `POST /api/voice/tts`
- **Input:** `{ "text": str, "language": str }`
- **Output:** `audio/mpeg` binary stream OR `{ "fallback": true }` on 429
- **Logic:**
  1. Truncate text to 4500 chars (ElevenLabs per-call safe limit)
  2. Call ElevenLabs Python SDK: `client.text_to_speech.convert(voice_id=..., text=..., model_id="eleven_multilingual_v2")`
  3. If ElevenLabs returns 429 → return `JSONResponse({ "fallback": true }, status_code=200)`
  4. Otherwise → return `Response(content=b"".join(audio_generator), media_type="audio/mpeg")`

### 4.2 New file: `utils/voice_helpers.py`

```python
# Groq transcription helper
def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    # Returns { transcript, language, duration_s }

# ElevenLabs TTS helper  
def text_to_speech(text: str) -> bytes | None:
    # Returns audio bytes, or None if quota exceeded (429)
```

### 4.3 Register router in `main.py`

```python
from routers.voice import router as voice_router
app.include_router(voice_router, prefix="/api/voice", tags=["Voice"])
```

### 4.4 New env vars (backend `.env`)

```env
# Already present — no new Groq key needed
GROQ_API_KEY=...

# Add these:
ELEVENLABS_API_KEY=<regenerated key>
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 4.5 New dependency

```
elevenlabs>=1.0.0
```

Add to `requirements.txt`.

---

## 5. Frontend

### 5.1 New file: `hooks/useVoiceRecorder.ts`

State machine: `idle → recording → transcribing → done → idle`

```typescript
type RecorderState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

interface UseVoiceRecorderReturn {
  state: RecorderState
  transcript: string
  language: string
  startRecording: () => Promise<void>
  stopRecording: () => void
  reset: () => void
  errorMessage: string
}
```

**Behaviour:**
- `startRecording()`: requests mic permission → starts MediaRecorder (mimeType: `audio/webm;codecs=opus`)
- `stopRecording()`: stops MediaRecorder → collects Blob → POSTs to `/api/voice/transcribe` → sets transcript + language → state = `done`
- On mic permission denied: state = `error`, errorMessage = "Benarkan akses mikrofon dalam tetapan pelayar"
- On audio < 0.5s: state = `error`, errorMessage = "Rakaman terlalu pendek — cuba lagi"
- On transcription failure: state = `error`, errorMessage = "Gagal mentranskrip — taip soalan anda"
- `reset()`: clears transcript, back to `idle`

### 5.2 New file: `components/VoiceMicButton.tsx`

```typescript
interface VoiceMicButtonProps {
  onTranscript: (text: string, language: string) => void
}
```

Renders mic button in chat input bar. Visual states:

| State | Appearance |
|---|---|
| `idle` | Grey circle, mic icon |
| `recording` | Red circle, waveform bars, pulsing ring animation |
| `transcribing` | Amber circle, spinning gear icon |
| `done` | Green circle, checkmark — auto-resets to idle after 1.5s |
| `error` | Shows toast via existing toast system, resets to idle |

On `done`: calls `onTranscript(transcript, language)`.

### 5.3 New file: `hooks/useTTS.ts`

```typescript
type TTSState = 'idle' | 'loading' | 'playing' | 'error'

interface UseTTSReturn {
  play: (text: string, language: string) => Promise<void>
  stop: () => void
  state: TTSState
}
```

**Behaviour:**
1. POST `{ text, language }` to `/api/voice/tts`
2. If response is `audio/mpeg` → `URL.createObjectURL(blob)` → `new Audio(url).play()`
3. If response is `{ fallback: true }` → `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))` with `lang` set to `ms-MY` / `en-MY` / `zh-CN`
4. If network error → attempt `speechSynthesis` fallback silently
5. `stop()`: pauses audio element OR cancels speechSynthesis

### 5.4 New file: `components/VoiceSpeaker.tsx`

```typescript
interface VoiceSpeakerProps {
  text: string
  language: string
}
```

Renders inline `🔊 Dengar Jawapan` button below each AI answer bubble.  
Uses `useTTS` hook. States: idle → loading spinner → playing (stop icon) → idle.

### 5.5 Modify: `components/elements/ai-elements/chat/chat-input.tsx` (existing)

- `ChatInput` already accepts a `children` prop — pass `VoiceMicButton` as child
- In the parent that renders `ChatInput`, add: `<ChatInput ...><VoiceMicButton onTranscript={(text) => onChange(text)} /></ChatInput>`
- Transcript fills the textarea value. **User must press Send manually** — no auto-submit.
- No changes to `ChatInput` internals required

### 5.6 Modify: `components/chat-panel/message-cards.tsx` (existing)

- `Message` interface already has `answer: string` and `language: string` — exactly what `VoiceSpeaker` needs
- Add `<VoiceSpeaker text={message.answer} language={message.language} />` below the answer text block in the AI message card
- Also add auto-speak toggle (stored in `localStorage` key `"lingua-autospeak"`, off by default): when on, `useTTS.play()` fires automatically when a new non-streaming message arrives (`isStreaming === false`)

---

## 6. Error Handling

| Scenario | User-facing behaviour |
|---|---|
| Mic permission denied | Toast: "Benarkan akses mikrofon dalam tetapan pelayar" |
| Recording < 0.5s | Toast: "Rakaman terlalu pendek — cuba lagi" |
| Groq Whisper fails | Toast: "Gagal mentranskrip — taip soalan anda" |
| ElevenLabs 429 (quota) | Silent fallback to `speechSynthesis` — no error shown |
| ElevenLabs API down | Silent fallback to `speechSynthesis` |
| Browser no TTS support | Toast: "TTS tidak disokong pada pelayar ini" only if both ElevenLabs AND speechSynthesis unavailable |
| Network offline | Mic button disabled; existing offline indicator handles display |

---

## 7. File Checklist

```
backend/
  routers/voice.py          NEW
  utils/voice_helpers.py    NEW
  main.py                   MODIFY — register voice router
  requirements.txt          MODIFY — add elevenlabs>=1.0.0
  .env                      MODIFY — add ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

frontend/src/
  hooks/useVoiceRecorder.ts    NEW
  hooks/useTTS.ts              NEW
  components/VoiceMicButton.tsx  NEW
  components/VoiceSpeaker.tsx    NEW
  components/ChatInput.tsx       MODIFY — add VoiceMicButton
  components/chat-panel/message-cards.tsx  MODIFY — add VoiceSpeaker + auto-speak toggle
```

---

## 8. Testing Checklist

- [ ] Mic button cycles through all 4 states (idle → recording → transcribing → done)
- [ ] BM question transcribed correctly by Groq Whisper
- [ ] EN question transcribed correctly
- [ ] ZH question transcribed correctly  
- [ ] Transcript fills chat input field
- [ ] Manual send triggers normal RAG pipeline
- [ ] 🔊 button plays ElevenLabs audio
- [ ] ElevenLabs 429 silently falls back to speechSynthesis
- [ ] Auto-speak toggle persists across page reload (localStorage)
- [ ] Mic permission denied shows correct toast (in BM)
- [ ] Short recording shows correct toast
- [ ] Rate limit (10 req/min) blocks abuse without crashing
