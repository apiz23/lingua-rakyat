import { localizeMetadata } from "@/lib/i18n/metadata"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { AdminShell } from "@/components/admin/admin-shell"
import { getLocale } from "@/lib/i18n/server"
import { localizeHref } from "@/lib/i18n/routing"
import { headers } from "next/headers"

const pageMetadata: Metadata = {
  title: "Administration | Lingua Rakyat",
  description: "Operational administration for document publication.",
  robots: { index: false, follow: false },
}

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  const locale = await getLocale()
  if (!userId)
    redirect(
      localizeHref("/sign-in", locale) +
        "?redirect_url=" +
        encodeURIComponent((await headers()).get("x-lingua-path") ?? "/manage")
    )
  return <AdminShell>{children}</AdminShell>
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(pageMetadata)
}
