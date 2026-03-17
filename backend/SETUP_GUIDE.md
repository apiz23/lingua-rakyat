# Civic AI — Complete Setup Guide

This guide walks you through setting up the FastAPI backend from zero to a running server.
Follow every step in order, Hafiz.

---

## Prerequisites

Before you start, make sure you have these installed on your computer:

| Tool         | Check if installed | Install link                 |
| ------------ | ------------------ | ---------------------------- |
| Python 3.10+ | `python --version` | https://python.org/downloads |
| pip          | `pip --version`    | Comes with Python            |
| Node.js 18+  | `node --version`   | https://nodejs.org           |
| Git          | `git --version`    | https://git-scm.com          |

---

## Step 1 — Get a Free Groq API Key

Groq gives you free access to Llama3. No credit card needed.

1. Go to https://console.groq.com
2. Sign up with your email
3. Click **API Keys** in the left sidebar
4. Click **Create API Key**
5. Copy the key — it looks like `gsk_xxxxxxxxxxxxxxxxxxxx`

Keep this key safe. You will need it in Step 4.

---

## Step 2 — Clone / Download the Backend Code

If you received this as a zip file, extract it.
If you are using Git:

```bash
git clone https://github.com/your-username/lingua-rakyat-backend.git
cd lingua-rakyat-backend
```

Or just create the folder manually and copy the files in.

---

## Step 3 — Create a Python Virtual Environment

A virtual environment keeps this project's packages separate from your system Python.
This is a best practice — always do this for Python projects.

```bash
# Create the virtual environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Activate it (Mac / Linux)
source venv/bin/activate
```

You will see `(venv)` at the start of your terminal prompt.
This means the virtual environment is active.

---

## Step 4 — Install All Dependencies

```bash
pip install -r requirements.txt
```

This installs FastAPI, LangChain, ChromaDB, sentence-transformers, and all other packages.

> **Note:** The first time you run the server, it will download the `bge-m3` embedding model
> (~570 MB). This happens automatically. Make sure you have a good internet connection.

---

## Step 5 — Create Your .env File

Copy the example file and fill in your values:

```bash
# Mac / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Now open `.env` in any text editor and replace `your_groq_api_key_here` with your actual key:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama3-70b-8192
EMBEDDING_MODEL=BAAI/bge-m3
CHROMA_PERSIST_DIR=./chroma_db
UPLOAD_DIR=./documents
TOP_K_CHUNKS=4
```

Save the file.

---

## Step 6 — Create the Required Folders

```bash
mkdir documents
mkdir chroma_db
```

These folders store uploaded PDFs and the ChromaDB vector database respectively.

---

## Step 7 — Run the Server

```bash
uvicorn main:app --reload --port 8000
```

What this command means:

- `uvicorn` — the ASGI web server
- `main:app` — run the `app` object from `main.py`
- `--reload` — automatically restart when you change code (development mode)
- `--port 8000` — listen on port 8000

You should see output like:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345]
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## Step 8 — Test the API

Open your browser and go to:

```
http://localhost:8000
```

You should see:

```json
{
	"status": "ok",
	"message": "Civic AI backend is running",
	"docs": "Visit /docs for the interactive API documentation"
}
```

Now go to:

```
http://localhost:8000/docs
```

This is the **automatic interactive API documentation** that FastAPI generates.
You can test every endpoint directly from the browser — no Postman needed!

---

## Step 9 — Test the Full Pipeline

### Test 1: Upload a PDF

In the `/docs` page:

1. Click on `POST /api/documents/upload`
2. Click **Try it out**
3. Click **Choose File** and select any PDF
4. Click **Execute**

You should see a response like:

```json
{
  "success": true,
  "document": {
    "id": "a1b2c3d4-...",
    "name": "my_document.pdf",
    "chunk_count": 42,
    "status": "ready",
    ...
  },
  "message": "Document processed into 42 chunks"
}
```

Copy the `id` value — you need it for the next test.

### Test 2: Ask a Question

1. Click on `POST /api/chat/ask`
2. Click **Try it out**
3. Fill in the request body:

```json
{
	"document_id": "paste-the-id-from-test-1-here",
	"document_name": "my_document.pdf",
	"question": "What is the main topic of this document?"
}
```

4. Click **Execute**

You should see an AI-generated answer based on your document!

---

## Project File Structure

```
lingua-rakyat-backend/
│
├── main.py                    ← App entry point, CORS, router registration
├── requirements.txt           ← All Python packages
├── .env.example               ← Template for environment variables
├── .env                       ← Your actual secrets (DO NOT commit to Git)
│
├── routers/
│   ├── __init__.py
│   ├── documents.py           ← Upload, list, delete document endpoints
│   └── chat.py                ← Ask question, get history endpoints
│
├── utils/
│   ├── __init__.py
│   └── rag_pipeline.py        ← ALL the AI logic (the most important file)
│
├── documents/                 ← Uploaded PDFs + metadata.json + chat_history.json
└── chroma_db/                 ← ChromaDB vector database files (auto-created)
```

---

## Connecting to the Next.js Frontend

In your Next.js app, set this environment variable in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then make API calls like this:

```javascript
// Upload a document
const uploadDocument = async (file) => {
	const formData = new FormData();
	formData.append("file", file);

	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/documents/upload`,
		{
			method: "POST",
			body: formData,
		},
	);

	return response.json();
};

// Ask a question
const askQuestion = async (documentId, documentName, question) => {
	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/chat/ask`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				document_id: documentId,
				document_name: documentName,
				question,
			}),
		},
	);

	return response.json();
};

// List documents
const listDocuments = async () => {
	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/documents/`,
	);
	return response.json();
};
```

---

## API Reference

| Method   | Endpoint                            | Description                |
| -------- | ----------------------------------- | -------------------------- |
| `GET`    | `/`                                 | Health check               |
| `POST`   | `/api/documents/upload`             | Upload PDF + run ingestion |
| `GET`    | `/api/documents/`                   | List all documents         |
| `DELETE` | `/api/documents/{id}`               | Delete a document          |
| `POST`   | `/api/chat/ask`                     | Ask a question             |
| `GET`    | `/api/chat/history?document_id=...` | Get chat history           |
| `DELETE` | `/api/chat/history/{document_id}`   | Clear chat history         |

---

## Common Errors and Fixes

| Error                            | Cause                       | Fix                                   |
| -------------------------------- | --------------------------- | ------------------------------------- |
| `GROQ_API_KEY is not set`        | Missing .env file           | Create .env from .env.example         |
| `No module named 'fastapi'`      | Packages not installed      | Run `pip install -r requirements.txt` |
| `Could not extract any text`     | Scanned PDF (image-based)   | Use a text-based PDF                  |
| `Connection refused` on frontend | Backend not running         | Run `uvicorn main:app --reload`       |
| First request very slow          | Downloading embedding model | Wait 1–2 minutes, it caches after     |

---

## Deployment (After Hackathon)

| Service     | What to deploy   | Free tier           |
| ----------- | ---------------- | ------------------- |
| **Vercel**  | Next.js frontend | Yes                 |
| **Render**  | FastAPI backend  | Yes (750 hrs/month) |
| **Railway** | FastAPI backend  | Yes ($5 credit)     |

For Render deployment:

1. Push code to GitHub
2. Create new Web Service on Render
3. Set Build Command: `pip install -r requirements.txt`
4. Set Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add all `.env` variables in the Environment section

---

## What You Have Learned

By building this backend, you have implemented:

- **FastAPI** — building REST APIs with Python
- **RAG architecture** — the foundation of modern AI applications
- **LangChain** — orchestrating AI pipelines
- **ChromaDB** — vector databases and semantic search
- **Multilingual embeddings** — cross-lingual document retrieval
- **Groq + Llama3** — fast, free LLM integration
