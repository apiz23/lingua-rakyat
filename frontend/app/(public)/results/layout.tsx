import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from "next"


const pageMetadata: Metadata = {
  title: "Project Showcase",
  description:
    "Lingua Rakyat showcase: the problem it solves, how the retrieval pipeline works, and measured evaluation results.",
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(pageMetadata) }
