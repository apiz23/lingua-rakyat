import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from "next"

const pageMetadata: Metadata = {
  title: "Benchmark Lab",
  description:
    "Compare answer quality and latency across hosted models on the same government documents and question set.",
  robots: { index: false },
}

export default function BenchmarkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(pageMetadata) }
