"use client"

import { useRef } from "react"
import { useLanguage } from "@/components/language-provider"
import { useLandingMotion } from "./use-landing-motion"
import styles from "@/app/(public)/landing.module.css"

export function ExperienceShell({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const { language } = useLanguage()
  useLandingMotion(root, language)
  return (
    <div ref={root} className={styles.landing} data-immersive-landing>
      {children}
    </div>
  )
}
