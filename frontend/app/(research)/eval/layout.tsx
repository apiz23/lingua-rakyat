import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Quality Dashboard",
  description:
    "Retrieval and answer quality for Lingua Rakyat: ROUGE, BLEU, readability, latency, confidence, and the streamed evaluation suite.",
  robots: { index: false },
}

export default function EvalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
