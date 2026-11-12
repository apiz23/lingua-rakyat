import { localizeMetadata } from "@/lib/i18n/metadata"
import type { Metadata } from "next"

import { AdminShell } from "@/components/admin/admin-shell"

const pageMetadata: Metadata = {
  title: "Administration | Lingua Rakyat",
  description: "Operational administration for document publication.",
  robots: { index: false, follow: false },
}

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(pageMetadata)
}
