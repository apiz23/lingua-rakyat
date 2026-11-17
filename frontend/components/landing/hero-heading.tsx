"use client"

import { motion, useReducedMotion } from "framer-motion"

export function HeroHeading({
  first,
  second,
}: {
  first: string
  second: string
}) {
  const reduced = useReducedMotion()
  return (
    <h1>
      {[first, second].map((line, index) => (
        <span key={line} data-headline-line={index}>
          {line.split(" ").map((word, wordIndex) => (
            <motion.span
              key={wordIndex}
              initial={{ y: 0, opacity: 1 }}
              animate={reduced ? undefined : { y: [22, 0], opacity: [0.65, 1] }}
              transition={{
                duration: 0.65,
                delay: index * 0.12 + wordIndex * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {word}{" "}
            </motion.span>
          ))}
        </span>
      ))}
    </h1>
  )
}
