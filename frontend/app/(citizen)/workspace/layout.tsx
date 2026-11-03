import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Ask questions about a government document in English, Bahasa Melayu, or Chinese and get answers grounded in the PDF, with sources cited.",
  robots: { index: false },
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
