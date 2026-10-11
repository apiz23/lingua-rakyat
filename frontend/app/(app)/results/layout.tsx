import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Project Showcase",
  description:
    "Lingua Rakyat showcase: the problem it solves, how the retrieval pipeline works, and measured evaluation results.",
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
