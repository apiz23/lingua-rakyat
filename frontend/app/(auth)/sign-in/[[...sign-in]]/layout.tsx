import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Lingua Rakyat to upload government documents, keep your chat history, and share answers.",
  robots: { index: false, follow: true },
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
