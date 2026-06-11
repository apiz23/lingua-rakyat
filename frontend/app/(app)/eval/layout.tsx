import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Quality Dashboard",
}

export default function EvalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
