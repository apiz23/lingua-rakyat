"use client"

import { cn } from "@/lib/utils"
import { motion, useReducedMotion } from "framer-motion"

interface HeroTextProps {
  text?: string
  className?: string
}

/** Inline shutter text. Typography and available width are inherited from the heading. */
export default function HeroText({
  text = "IMMERSE",
  className,
}: HeroTextProps) {
  const reducedMotion = useReducedMotion()
  const words = text.split(" ")

  return (
    <span className={cn("block max-w-full", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
          const offset = Array.from(words.slice(0, wordIndex).join("")).length
          return (
            <span key={wordIndex}>
              {wordIndex > 0 ? " " : null}
              <span className="inline-block whitespace-nowrap">
                {Array.from(word).map((character, index) => {
                  const delay = Math.min((offset + index) * 0.025, 0.65)
                  return (
                    <span
                      key={index}
                      className="relative -mb-[0.08em] inline-block overflow-hidden pb-[0.08em] align-bottom"
                    >
                      <motion.span
                        className="inline-block"
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.2, duration: 0.5 }}
                      >
                        {character}
                      </motion.span>
                      {!reducedMotion &&
                        [
                          "polygon(0 0, 100% 0, 100% 35%, 0 35%)",
                          "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)",
                          "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)",
                        ].map((clipPath, slice) => (
                          <motion.span
                            key={slice}
                            className={cn(
                              "pointer-events-none absolute inset-0 inline-block",
                              slice === 1 ? "text-foreground" : "text-primary"
                            )}
                            style={{ clipPath }}
                            initial={{
                              x: slice === 1 ? "100%" : "-100%",
                              opacity: 0,
                            }}
                            animate={{
                              x: slice === 1 ? "-100%" : "100%",
                              opacity: [0, 1, 0],
                            }}
                            transition={{
                              duration: 0.7,
                              delay: delay + slice * 0.08,
                              ease: "easeInOut",
                            }}
                          >
                            {character}
                          </motion.span>
                        ))}
                    </span>
                  )
                })}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
