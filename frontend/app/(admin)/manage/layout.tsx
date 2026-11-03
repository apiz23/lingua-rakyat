import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Document Manager",
  description:
    "Upload official government PDFs, review their processing status, and manage the document library.",
  robots: { index: false },
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
