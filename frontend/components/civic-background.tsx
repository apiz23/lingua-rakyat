"use client"

import { useState } from "react"
import { useReducedMotion } from "framer-motion"
import styles from "./civic-background.module.css"

export default function CivicBackground({ language }: { language: string }) {
  const [paused, setPaused] = useState(false)
  const reducedMotion = useReducedMotion()
  const still = paused || reducedMotion
  return (
    <>
      <div
        aria-hidden="true"
        className={styles.background}
        data-paused={still ? "true" : "false"}
      >
        <svg className={styles.documents} viewBox="0 0 220 280" fill="none">
          <rect
            x="36"
            y="24"
            width="150"
            height="210"
            rx="5"
            transform="rotate(12 110 130)"
          />
          <rect
            x="20"
            y="40"
            width="150"
            height="210"
            rx="5"
            className={styles.paper}
          />
          <path d="M44 76h64M44 88h39M44 119h101M44 132h101M44 145h79M44 170h101M44 183h90M44 196h56" />
          <path d="M130 212h16v16h-16zM44 222h40" />
        </svg>
        <svg className={styles.arch} viewBox="0 0 250 280" fill="none">
          <path d="M30 250V130a95 95 0 0 1 190 0v120M48 250V130a77 77 0 0 1 154 0v120M66 250V130a59 59 0 0 1 118 0v120M84 250V130a41 41 0 0 1 82 0v120M102 250V130a23 23 0 0 1 46 0v120M16 250h218M16 260h218" />
          <path d="M125 12v15M8 130h15M227 130h15" />
        </svg>
        <svg className={styles.citation} viewBox="0 0 100 100" fill="none">
          <path d="M20 38V20h18M62 20h18v18M80 62v18H62M38 80H20V62" />
          <path d="M38 42h8v10h-8v-10l5-9M56 42h8v10h-8v-10l5-9M34 65h32" />
        </svg>
        <div className={styles.orbit} />
        <span className={styles.crossOne}>+</span>
        <span className={styles.crossTwo}>+</span>
      </div>
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          className={styles.control}
        >
          <span aria-hidden="true">{paused ? "?" : "?"}</span>
          {language === "ms"
            ? paused
              ? "Sambung animasi"
              : "Jeda animasi"
            : paused
              ? "Resume motion"
              : "Pause motion"}
        </button>
      )}
    </>
  )
}
