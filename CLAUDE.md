# Lingua Rakyat — Claude Instructions

## Project Overview
Multilingual RAG assistant for Malaysian government PDF documents. Users upload official PDFs and ask questions in Malay, English, or Chinese. Backend: FastAPI + Cohere + Pinecone + Groq. Frontend: Next.js + Tailwind + shadcn/ui.

## Design Context

### Users
Malaysian citizens of all ages and backgrounds, accessing government PDF documents (LHDN, KWSP, JPN, etc.) through a multilingual AI assistant. Primary context: desktop browser (demo booth at RISE 2026, then real-world use). Secondary: mobile. Users range from tech-savvy young adults to older citizens unfamiliar with AI tools. Also evaluated by academic/industry judges at an innovation competition.

### Brand Personality
**3 words: sharp, civic, confident.**

Bold enough to be memorable and unlike anything else in Malaysian GovTech. Grounded enough to be trusted by a first-time citizen user. This is not a startup, not a chatbot, not a government portal — it occupies a new space: civic AI that looks serious and capable.

Emotional goal: A citizen opens the app and immediately feels "this was made for me, it can help me."

### Aesthetic Direction
**Reference**: Notion — document-centric layout, strong typographic hierarchy, calm workspace. Borrow the content-first philosophy and whitespace discipline, but with more visual confidence and character.

**Anti-references**:
- Generic AI chatbot (no purple/blue gradients, no glowing orbs, no GPT-clone vibes)
- Outdated Malaysian government portal (no blue/red flag palette, no table-heavy layouts, no Comic Sans-era typography)

**Theme**: System (both light and dark). Light mode is the primary design target — professional, high readability, civic feel. Dark mode follows.

**Color direction**: Deep civic green as primary. `oklch(0.38 0.13 145)` — authoritative and accessible. Neutrals tinted slightly toward green. No AI chatbot purple-to-blue gradients.

**Typography**:
- Display/headings: **Bricolage Grotesque** (variable grotesque, expressive editorial character)
- Body: **Atkinson Hyperlegible** (designed for low-vision readability — deliberate accessibility statement)

**Layout philosophy**: Left-aligned, document-centric, asymmetric where it adds emphasis. Content earns its space.

### Design Principles
1. **Document-first hierarchy** — content and answers lead; UI chrome steps back completely
2. **Civic confidence** — bold enough to be memorable, grounded enough to be trusted by any citizen
3. **Accessibility over decoration** — typography, contrast, and spacing serve users, not aesthetics
4. **Zero AI tells** — no gradient text, no glowing borders, no purple accents, no sparklines, no floating orbs
5. **System-native respect** — supports light and dark themes, adapts to context rather than imposing a mood
