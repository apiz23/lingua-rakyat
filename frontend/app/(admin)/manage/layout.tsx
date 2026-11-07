import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  title: "Administration | Lingua Rakyat",
  description: "Operational administration for document publication.",
  robots: { index: false, follow: false },
}

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=%2Fmanage')
  return <AdminShell>{children}</AdminShell>
}
