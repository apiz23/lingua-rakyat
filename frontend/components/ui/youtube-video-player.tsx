"use client"

import { useEffect, useState } from "react"
import { Maximize2, Minimize2, Play } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface YouTubePlayerProps {
  videoId: string
  title?: string
  className?: string
}

export function YouTubePlayer({
  videoId,
  title,
  className,
}: YouTubePlayerProps) {
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handlePlay = () => setPlaying(true)
  const toggleExpand = () => setExpanded((prev) => !prev)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false)
    }
    if (expanded) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [expanded])

  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  return (
    <>
      {/* NORMAL VIEW */}
      <div
        className={cn(
          "relative",
          expanded && "pointer-events-none opacity-0",
          className
        )}
      >
        <div className="relative overflow-hidden rounded-xl border bg-card shadow-lg">
          <div className="relative aspect-video bg-muted">
            {!playing ? (
              <>
                <img
                  src={thumbnail}
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Button
                    onClick={handlePlay}
                    className="h-16 w-16 rounded-full"
                  >
                    <Play className="h-6 w-6 fill-white" />
                  </Button>

                  {title && <p className="mt-4 text-center text-sm">{title}</p>}
                </div>
              </>
            ) : (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                className="h-full w-full"
                allowFullScreen
              />
            )}

            {/* Expand Button */}
            <button
              onClick={toggleExpand}
              className="absolute top-2 left-3 z-20 rounded-full bg-black/50 p-2"
            >
              <Maximize2 className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED VIEW (3/4 SCREEN) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <>
                {/* BACKDROP */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
                  onClick={toggleExpand}
                />

                {/* CENTERED PLAYER */}
                <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center px-4">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      (className =
                        "pointer-events-auto relative aspect-video w-[75vw] max-w-[1000px] overflow-hidden rounded-xl bg-black shadow-2xl")
                    )}
                  >
                    {!playing ? (
                      <>
                        <img
                          src={thumbnail}
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                        />

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Button
                            onClick={handlePlay}
                            className="h-20 w-20 rounded-full"
                          >
                            <Play className="h-8 w-8 fill-white" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                        className="h-full w-full"
                        allowFullScreen
                      />
                    )}

                    {/* CLOSE BUTTON */}
                    <button
                      onClick={toggleExpand}
                      className="absolute top-3 left-3 z-20 rounded-full bg-black/50 p-2"
                    >
                      <Minimize2 className="h-5 w-5 text-white" />
                    </button>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
