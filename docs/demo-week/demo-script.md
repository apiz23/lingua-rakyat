# Lingua Rakyat 3-Minute Demo Script

## Goal

Show the judge that Lingua Rakyat turns a government PDF into a multilingual, cited answer with trust signals.

## Setup Before Recording

- Open the app at `http://localhost:3000/workspace`.
- Use a small LHDN PDF that has clear page text.
- Make sure the backend is running and the document is not already selected.
- Keep browser zoom at 100%.
- Clear unrelated browser tabs.

## Walkthrough Script

### 0:00-0:20 - Opening

Say:

> Lingua Rakyat helps Malaysians understand official government PDFs in plain language. I will upload an LHDN document, ask a question in Malay, then ask the same thing in English with different phrasing.

Action:

- Open Workspace.
- Show empty or document list state.

### 0:20-0:55 - Upload LHDN PDF

Say:

> First, I upload the official PDF. The system extracts the document, chunks it by section and page, then indexes it for retrieval.

Action:

- Click Upload Document.
- Enter admin token.
- Select the LHDN PDF.
- Wait for the ready state.
- Select the uploaded PDF.

### 0:55-1:40 - Ask In Malay

Say:

> Now I ask in Malay, the way a citizen would naturally ask.

Question:

> Siapa yang layak untuk pelepasan cukai ini?

Action:

- Submit the question.
- Wait for answer.
- Open Sources.

Say:

> The answer is short, in Malay, and it shows the cited document page. This matters because citizens can verify the answer against the original PDF.

### 1:40-2:25 - Switch To English

Say:

> Now I switch phrasing and language. I do not need to upload another file.

Question:

> What are the eligibility conditions for this tax relief?

Action:

- Submit the English question.
- Open sources again.

Say:

> The app detects the language per turn and retrieves from the same official document. The source and confidence badge stay visible so the answer is transparent.

### 2:25-3:00 - Trust + Offline Close

Say:

> For demo booths with unstable internet, Lingua Rakyat also keeps cached documents and source excerpts on the device. If the network drops, the app can still show previous documents and a basic cached answer instead of crashing.

Action:

- Point at cited page/confidence badge.
- If already prepared, briefly toggle offline mode or show offline badge.

Closing line:

> Lingua Rakyat is not just a chatbot. It is a civic document assistant: multilingual, source-backed, and built for Malaysian citizens.

## Recording Checklist

- Target length: 2:45-3:10.
- Keep cursor movement slow.
- Pause after each answer so sources are readable.
- Do one full practice recording before the final take.
- Save final file as `lingua-rakyat-demo-lhdn.mp4`.
