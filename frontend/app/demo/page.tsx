"use client"

import { useEffect, useState, useRef } from "react"
import { Document, listDocuments, askQuestion } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { cn } from "@/lib/utils"
import Image from "next/image"
import logo from "@/public/icons/android-chrome-512x512.png"

const DEMO_SESSION_ID = "demo-booth-session"

const SCENARIO_CARDS = [
  {
    docId: "jpn-mykad-faq",
    flag: "🇲🇾",
    lang: "Bahasa Melayu",
    question: "Siapa yang layak memohon MyKad?",
    docLabel: "MyKad FAQ",
  },
  {
    docId: "jpn-mykad-faq",
    flag: "🇬🇧",
    lang: "English",
    question: "What documents are required to apply for MyKad?",
    docLabel: "MyKad FAQ",
  },
  {
    docId: "imigresen-passport",
    flag: "🇲🇾",
    lang: "Bahasa Melayu",
    question: "Bagaimana cara memohon pasport Malaysia buat kali pertama?",
    docLabel: "Passport",
  },
  {
    docId: "imigresen-passport",
    flag: "🇨🇳",
    lang: "中文",
    question: "如何申请马来西亚护照？",
    docLabel: "Passport",
  },
]

export default function DemoPage() {
  const [docs, setDocs] = useState<Record<string, Document>>({})
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()
  const [showChat, setShowChat] = useState(false)
  const prewarmRef = useRef(false)

  useEffect(() => {
    listDocuments()
      .then((all) => {
        const featured = all.filter((d) => d.is_featured && d.status === "ready")
        const byId = Object.fromEntries(featured.map((d) => [d.id, d]))
        setDocs(byId)

        if (!prewarmRef.current && featured.length > 0) {
          prewarmRef.current = true
          for (const card of SCENARIO_CARDS) {
            const doc = byId[card.docId]
            if (!doc) continue
            askQuestion(
              "demo-prewarm",
              doc.id,
              doc.name,
              DEMO_SESSION_ID + "-prewarm",
              card.question,
              "",
              false,
              false
            ).catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [])

  function handleScenarioClick(docId: string, question: string) {
    const doc = docs[docId]
    if (!doc) return
    setSelectedDoc(doc)
    setInitialQuestion(question)
    setShowChat(true)
  }

  function handleBack() {
    setShowChat(false)
    setSelectedDoc(null)
    setInitialQuestion(undefined)
  }

  const docsReady = Object.keys(docs).length > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Image src={logo} alt="Lingua Rakyat" width={28} height={28} className="rounded-full" />
          <span className="font-heading text-base font-bold tracking-tight text-foreground">
            Lingua Rakyat
          </span>
          <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Demo
          </span>
        </div>
        {showChat && (
          <button
            onClick={handleBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            ← Back to scenarios
          </button>
        )}
      </header>

      {!showChat ? (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              Malaysian Government Document Assistant
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask questions in Malay, English, or Chinese — get answers grounded in official documents.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Try a scenario
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SCENARIO_CARDS.map((card) => {
                const available = Boolean(docs[card.docId])
                return (
                  <button
                    key={card.question}
                    disabled={!available}
                    onClick={() => handleScenarioClick(card.docId, card.question)}
                    className={cn(
                      "flex flex-col items-start gap-2 border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      !available && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{card.flag}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {card.lang}
                        </span>
                      </div>
                      <span className="border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {card.docLabel}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground">
                      {card.question}
                    </p>
                  </button>
                )
              })}
            </div>

            {!docsReady && (
              <p className="mt-4 text-xs text-muted-foreground">
                Loading featured documents…
              </p>
            )}
          </div>

          <div className="border-t border-border/40 pt-6">
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <span className="font-medium text-foreground">Cohere</span> embeddings ·{" "}
              <span className="font-medium text-foreground">Pinecone</span> vector search ·{" "}
              <span className="font-medium text-foreground">Groq</span> LLM inference
            </p>
          </div>
        </main>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatPanel
            selectedDoc={selectedDoc}
            initialQuestion={initialQuestion}
            onBack={handleBack}
          />
        </div>
      )}
    </div>
  )
}
