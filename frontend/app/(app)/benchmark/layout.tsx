import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Benchmark Lab",
  description:
    "Compare answer quality and latency across hosted models on the same government documents and question set.",
  robots: { index: false },
}

export default function BenchmarkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
