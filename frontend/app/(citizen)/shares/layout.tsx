import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shared Links",
  description: "Create, copy, and revoke public links to answers you have shared.",
  robots: { index: false },
}

export default function SharesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
