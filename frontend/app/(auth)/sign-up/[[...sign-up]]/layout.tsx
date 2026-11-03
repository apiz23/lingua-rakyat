import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a Lingua Rakyat account to ask questions about Malaysian government documents in English, Bahasa Melayu, or Chinese.",
  robots: { index: false, follow: true },
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
