"use client"

import { useTranslations } from "@/components/i18n"
import { ExperienceFrame } from "@/components/experience-nav"

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()

  return (
    <ExperienceFrame
      label={t("Research")}
      items={[
        { href: "/eval", label: "Evaluation" },
        { href: "/benchmark", label: "Benchmarks" },
      ]}
    >
      {children}
    </ExperienceFrame>
  )
}
