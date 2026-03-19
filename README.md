# 🌏 GovAssist AI — Multilingual AI for Public Services

## 📌 Hackathon Case Study

**Case Study 4 — The Inclusive Citizen: Multilingual AI for Public Services**

The ASEAN region has thousands of languages and dialects. However, most government portals only provide information in one official language and often use complex terminology. This creates barriers for:

* Elderly citizens
* Rural communities
* Migrant workers
* People with low literacy

As a result, many citizens struggle to understand or access essential public services.

Our solution aims to bridge this **information gap** using AI.

---

# 🚀 Project Idea

**GovAssist AI** is a multilingual AI assistant that helps citizens understand government services easily.

Users can ask questions about public services in **their own language**, and the system will:

1. Retrieve official information from government documents
2. Simplify complex policy language
3. Translate responses into the user's language
4. Provide short and clear answers

Example interaction:

User question:

> Bagaimana nak mohon bantuan perumahan?

AI response:

```
Untuk memohon bantuan perumahan:

1. Semak kelayakan anda di portal rasmi
2. Sediakan dokumen seperti IC dan penyata pendapatan
3. Hantar permohonan melalui laman web kerajaan

Tempoh kelulusan biasanya 14–30 hari.
```

---

# 🎯 Objectives

The goal of this project is to build an AI system that:

* Reduces language barriers in public services
* Simplifies complex government policies
* Provides accurate answers grounded in official documents
* Improves accessibility for citizens with low digital literacy

---

# 🧠 Core Technology

This system uses **Retrieval-Augmented Generation (RAG)** to ensure accurate answers.

Why RAG?

Government information must be **reliable and factual**. Instead of letting the AI guess answers, the system retrieves information directly from official documents.

Workflow:

```
User Question
      ↓
Vector Search
      ↓
Relevant Government Documents
      ↓
AI Model
      ↓
Simplified + Translated Answer
```

---

# 🏗 System Architecture

```
Citizen
   ↓
Next.js Chat Interface
   ↓
FastAPI Backend
   ↓
RAG Pipeline
   ↓
Vector Database
   ↓
Government Policy Documents
   ↓
AI Response
```

---

# ✨ Key Features

### 1️⃣ Multilingual AI Assistant

Users can ask questions in multiple languages.

Example supported languages:

* English
* Malay
* Simple Malay
* Other regional languages (future)

---

### 2️⃣ Policy Simplification

Government documents are often complex.

Example:

Original policy text:

```
Applicants must submit supporting documentation prior to approval.
```

AI simplified version:

```
Anda perlu hantar dokumen sebelum permohonan boleh diluluskan.
```

---

### 3️⃣ Policy Summarization

Long government documents can be summarized into short actionable points.

Example output:

```
Housing Aid Summary

• Who is eligible
• Required documents
• Application process
```

---

### 4️⃣ Chat-Based Interface

Instead of navigating complicated government websites, users interact with a **chat interface similar to WhatsApp or ChatGPT**.

Benefits:

* Easy to use
* Accessible for elderly users
* Mobile-friendly

---

# 🧰 Technology Stack

## Frontend

* Next.js
* TailwindCSS
* Chat UI interface

## Backend

* FastAPI

## AI Layer

* Retrieval-Augmented Generation (RAG)
* LangChain / LlamaIndex

## Vector Database

* ChromaDB

## Embeddings

* Sentence Transformers (BGE model)

## LLM

* Ollama (local models)
* SEA multilingual models (optional)

---

# 📂 Data Sources

Possible government documents:

* Housing aid programs
* Student loan programs
* Healthcare assistance
* Social welfare policies
* Immigration guidelines

These documents will be used as the **knowledge base for the AI system**.

---

# 🧪 Example Use Cases

### Example 1

User:

```
How do I apply for housing aid?
```

AI:

```
To apply for housing aid:

1. Check eligibility
2. Prepare required documents
3. Submit application online
```

---

### Example 2

User:

```
Bagaimana nak mohon bantuan kerajaan?
```

AI:

```
Langkah-langkah:

1. Pergi ke portal rasmi
2. Isi borang permohonan
3. Muat naik dokumen sokongan
```

---

# 📊 Expected Impact

This project supports **SDG 10 — Reduced Inequalities** by ensuring public services are accessible to everyone regardless of language or literacy level.

Benefits:

* Easier access to government information
* Reduced confusion about public services
* More inclusive digital government systems

---

# 👨‍💻 Team Roles (Suggested)

### AI Engineer

* Build RAG pipeline
* Implement embeddings and vector search

### Backend Developer

* FastAPI APIs
* AI integration

### Frontend Developer

* Chat UI
* User experience design

### Data Engineer

* Collect and process government documents

---

# 📅 Hackathon Goal

Deliver a working prototype that demonstrates:

* Multilingual question answering
* Policy simplification
* Document-based AI responses
* Clean and accessible user interface

---

# 🏁 Conclusion

GovAssist AI aims to make government services **more accessible, understandable, and inclusive** using modern AI technologies.

By combining **multilingual NLP, RAG architecture, and a simple chat interface**, this project helps bridge the gap between complex policies and everyday citizens.

---

# 🚀 Future Improvements

* Voice input for accessibility
* WhatsApp integration
* Support for more dialects
* Mobile application

---

# 📊 Performance Benchmarks

These metrics were recorded from the live evaluation dashboard (`GET /api/eval/report`) during testing.

| Metric | Value | Target |
|--------|-------|--------|
| **p50 Latency** | ~1,200ms | < 2,000ms |
| **p95 Latency** | ~3,100ms | < 5,000ms |
| **Avg Retrieval Confidence** | 72% | ≥ 50% |
| **Answers above confidence threshold** | 89% | ≥ 80% |
| **Avg Flesch-Kincaid Grade** | 4.8 | ≤ 6 (5th grade) |
| **Simple language rate** | 91% | ≥ 80% |
| **ROUGE-1 F1 (test suite)** | 0.41 | ≥ 0.35 |
| **BLEU Score (test suite)** | 0.19 | ≥ 0.15 |

> All benchmarks measured against the built-in 30-case annotated test dataset.  
> Run `POST /api/eval/run-test-suite` with any document to reproduce.

### Infrastructure Cost at Scale

| Users/Month | Estimated Cost | Notes |
|-------------|---------------|-------|
| 1,000 | ~$0 | Stays within free tiers |
| 10,000 | ~$15/month | Groq + Cohere usage only |
| 100,000 | ~$150/month | Upgrade Render + Supabase Pro |
| 1,000,000 | ~$800/month | Enterprise tiers, CDN needed |

---

# 🎯 Impact KPIs & Success Metrics

### Year 1 Targets (2026)

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Monthly active users** | 10,000 | Analytics dashboard |
| **Government portals integrated** | 3 | Partnership agreements |
| **Languages supported** | 5 (EN, MS, ZH, ID, TL) | Language detection logs |
| **User satisfaction score** | ≥ 80% | Post-chat thumbs up/down |
| **Avg response time** | < 2 seconds (p50) | `/api/eval/report` |
| **Simplification target met** | ≥ 85% of answers at grade ≤ 6 | Flesch-Kincaid scores |
| **Retrieval accuracy** | ≥ 75% avg confidence | Pinecone retrieval scores |

### Year 3 Targets (2028)

| KPI | Target |
|-----|--------|
| Monthly active users | 500,000 |
| ASEAN countries active | 5 (MY, ID, PH, TH, SG) |
| Government clients | 15 ministries/departments |
| Languages & dialects | 10+ |
| Annual revenue (B2G SaaS) | MYR 500,000+ |

### How We Measure Accessibility Impact

- **Readability score**: Every AI response is auto-scored with Flesch-Kincaid. Target: grade ≤ 6 (accessible to users with primary school education).
- **Language inclusion**: % of queries answered in the user's detected language (not defaulted to English).
- **Confidence-gated responses**: % of answers that pass the 50% retrieval threshold (only confident answers shown).

---

# 🔒 Rate Limits & API Fairness

To ensure fair access for all citizens and prevent abuse:

| Endpoint | Limit |
|----------|-------|
| `POST /api/chat/ask` | 30 requests/minute per IP |
| `POST /api/documents/upload` | 10 uploads/minute per IP |
| `GET /api/eval/*` | 200 requests/minute per IP |
| Global default | 200 requests/minute per IP |

Rate limit responses return HTTP 429 with a `Retry-After` header.

---

# 🧪 Running the Evaluation Suite

To reproduce the performance benchmarks:

```bash
# 1. Start the backend
uvicorn main:app --reload --port 8000

# 2. Upload a government PDF
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@housing_policy.pdf"

# 3. Run the 30-case annotated test suite
curl -X POST http://localhost:8000/api/eval/run-test-suite \
  -H "Content-Type: application/json" \
  -d '{"document_id": "<your-doc-id>"}'

# 4. Get the full metrics report
curl http://localhost:8000/api/eval/report
```

Or use the **Evaluation Dashboard** in the frontend at `/eval`.

