import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Project Showcase",
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
