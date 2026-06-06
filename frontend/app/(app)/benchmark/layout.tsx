import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Benchmark Lab",
}

export default function BenchmarkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
