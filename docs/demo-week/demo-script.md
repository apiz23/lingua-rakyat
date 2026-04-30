## Lingua Rakyat 3-Minute Demo Script (PTPTN Panduan Pengguna)

### **Goal**

Show the judge that Lingua Rakyat turns a government PDF into a multilingual, cited answer with trust signals.

---

## **Setup Before Recording**

- Open the app at `http://localhost:3000/workspace`.
- Use a **PTPTN “Panduan Pengguna”** PDF that has clear page text (searchable text, not scanned).
- Make sure the backend is running and the document is not already selected.
- Keep browser zoom at 100%.
- Clear unrelated browser tabs.

---

## **Walkthrough Script**

### **0:00-0:20 — Opening**

Say:

> Lingua Rakyat helps Malaysians understand official PDFs in plain language. I’ll upload an official PTPTN Panduan Pengguna, ask a question in Malay, then ask the same thing in English with different phrasing.

Action:

- Open Workspace.
- Show empty or document list state.

---

### **0:20-0:55 — Upload PTPTN PDF**

Say:

> First, I upload the official PTPTN PDF. The system extracts the document, chunks it by section and page, then indexes it for retrieval.

Action:

- Click Upload Document.
- Enter admin token.
- Select the **PTPTN Panduan Pengguna** PDF.
- Wait for the ready state.
- Select the uploaded PDF.

---

### **0:55-1:40 — Ask in Malay**

Say:

> Sekarang saya tanya dalam Bahasa Melayu, macam orang awam biasa tanya.

Question (Malay):

> Bagaimana cara log masuk, dan apa langkah jika saya terlupa kata laluan?

Action:

- Submit the question.
- Wait for answer.
- Open Sources.

Say:

> Jawapan ini ringkas dalam Bahasa Melayu, dan ia tunjuk sumber—siap dengan muka surat dokumen. Ini penting sebab pengguna boleh semak semula terus pada PDF rasmi.

---

### **1:40-2:25 — Switch to English**

Say:

> Now I switch phrasing and language. I don’t need to upload another file.

Question (English):

> How do I sign in, and what should I do if I forgot my password?

Action:

- Submit the English question.
- Open sources again.

Say:

> The app detects language per turn and retrieves from the same official PTPTN document. The source and confidence badge stay visible so the answer is transparent.

---

### **2:25-3:00 — Trust + Offline Close**

Say:

> For demo booths with unstable internet, Lingua Rakyat also keeps cached documents and source excerpts on the device. If the network drops, the app can still show previous documents and a basic cached answer instead of crashing.

Action:

- Point at cited page/confidence badge.
- If already prepared, briefly toggle offline mode or show offline badge.

Closing line:

> Lingua Rakyat is not just a chatbot. It is a civic document assistant: multilingual, source-backed, and built for Malaysian citizens.

---

## **Recording Checklist**

- Target length: 2:45–3:10.
- Keep cursor movement slow.
- Pause after each answer so sources are readable.
- Do one full practice recording before the final take.
- Save final file as `lingua-rakyat-demo-ptptn.mp4`.
