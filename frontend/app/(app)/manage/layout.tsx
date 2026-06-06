import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Document Manager",
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
