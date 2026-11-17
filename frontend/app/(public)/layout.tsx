"use client"

import { useTranslations, usePathname } from "@/components/i18n"
import { ExperienceNav } from "@/components/experience-nav"
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()
  const pathname = usePathname()

  return (
    <>
      <ExperienceNav
        editorial={pathname === "/"}
        label={t("Public portal")}
        items={[
          { href: "/", label: "Home" },
          { href: "/about", label: "About" },
          { href: "/results", label: "Results" },
        ]}
      />
      {children}
    </>
  )
}
