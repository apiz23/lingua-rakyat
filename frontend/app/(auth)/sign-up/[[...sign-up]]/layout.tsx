import { localizeMetadata } from '@/lib/i18n/metadata'
import type { Metadata } from "next"

const pageMetadata: Metadata = {
  title: "Create Account",
  description:
    "Create a Lingua Rakyat account to ask questions about Malaysian government documents in English, Bahasa Melayu, or Chinese.",
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export async function generateMetadata(): Promise<Metadata> { return localizeMetadata(pageMetadata) }
