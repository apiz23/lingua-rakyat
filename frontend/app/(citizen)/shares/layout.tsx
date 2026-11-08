import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from "next"

const pageMetadata: Metadata = {
  title: "Shared Links",
  description: "Create, copy, and revoke public links to answers you have shared.",
  robots: { index: false },
}

export default function SharesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(pageMetadata) }
