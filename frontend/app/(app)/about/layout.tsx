import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "Technical architecture, tech stack, and system flow behind Lingua Rakyat: ingestion, multilingual retrieval, and grounded answering.",
  openGraph: {
    title: "Architecture — Lingua Rakyat",
    description:
      "Technical architecture, tech stack, and system flow behind Lingua Rakyat: ingestion, multilingual retrieval, and grounded answering.",
    type: "website",
    url: "/about",
  },
}

export default function AboutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
