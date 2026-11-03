import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile",
  description: "Account details, shared answers, and sign-out for Lingua Rakyat.",
  robots: { index: false },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
