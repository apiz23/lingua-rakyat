"use client"

import { useEffect, type RefObject } from "react"

export function useLandingMotion(
  rootRef: RefObject<HTMLDivElement | null>,
  language: string
) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let cancelled = false
    let cleanup = () => {}

    async function initialize() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ])
      if (cancelled || !root) return
      gsap.registerPlugin(ScrollTrigger)
      let media = gsap.matchMedia()
      let fontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      )

      function configure() {
        if (!root) return
        root.dataset.largeText = String(fontSize > 20)
        media.revert()
        media = gsap.matchMedia()
        media.add(
          "(prefers-reduced-motion: no-preference)",
          () => {
            if (fontSize > 20) return
            root
              ?.querySelectorAll<HTMLElement>("[data-progress-word]")
              .forEach((word) => {
                gsap.fromTo(
                  word,
                  { color: "#94ad9d" },
                  {
                    color: "#f7f3e9",
                    ease: "none",
                    scrollTrigger: {
                      trigger: word,
                      start: "top 78%",
                      end: "top 38%",
                      scrub: true,
                      id: "lingua-word",
                    },
                  }
                )
              })
          },
          root
        )

        media.add(
          "(min-width: 1100px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)",
          () => {
            if (fontSize > 20 || !root) return
            root.dataset.scrollMotion = "on"
            root
              .querySelectorAll<HTMLElement>("[data-parallax]")
              .forEach((layer) => {
                const distance = Number(layer.dataset.parallax)
                gsap.to(layer, {
                  y: distance,
                  ease: "none",
                  scrollTrigger: {
                    trigger: root.querySelector("[data-hero]"),
                    start: "top top",
                    end: "bottom top",
                    scrub: 0.7,
                    id: "lingua-hero",
                  },
                })
              })

            const solution = root.querySelector<HTMLElement>(
              "[data-solution-art]"
            )
            if (solution)
              gsap.fromTo(
                solution,
                { clipPath: "inset(12% 9% 12% 9% round 32px)" },
                {
                  clipPath: "inset(0% 0% 0% 0% round 0px)",
                  ease: "none",
                  scrollTrigger: {
                    trigger: solution,
                    start: "top 85%",
                    end: "center 55%",
                    scrub: 0.5,
                    id: "lingua-reveal",
                  },
                }
              )

            const story = root.querySelector<HTMLElement>(
              "[data-story-container]"
            )
            const visual = root.querySelector<HTMLElement>(
              "[data-story-visual]"
            )
            const layers =
              root.querySelectorAll<HTMLElement>("[data-story-layer]")
            const steps =
              root.querySelectorAll<HTMLElement>("[data-story-step]")
            const progress = root.querySelector<HTMLElement>(
              "[data-story-progress]"
            )
            if (story && visual && layers.length === 3) {
              let active = -1
              const timeline = gsap.timeline({
                scrollTrigger: {
                  trigger: story,
                  start: () =>
                    `top ${(document.querySelector("header")?.getBoundingClientRect().height ?? 88) + 24}px`,
                  end: () =>
                    `+=${Math.max(400, story.offsetHeight - visual.offsetHeight)}`,
                  pin: visual,
                  pinSpacing: false,
                  scrub: 0.4,
                  invalidateOnRefresh: true,
                  id: "lingua-story",
                  onUpdate: (self) => {
                    const next =
                      self.progress < 0.33 ? 0 : self.progress < 0.67 ? 1 : 2
                    if (active === next) return
                    active = next
                    root.dataset.storyStage = String(next)
                    steps.forEach((step, index) => {
                      step.dataset.active = String(index === next)
                    })
                  },
                },
              })
              gsap.set(layers[0], { opacity: 1, y: 0 })
              gsap.set([layers[1], layers[2]], { opacity: 0, y: 24 })
              timeline
                .to(layers[0], { opacity: 0, y: -24, duration: 0.15 }, 0.25)
                .to(layers[1], { opacity: 1, y: 0, duration: 0.15 }, 0.25)
                .to(layers[1], { opacity: 0, y: -24, duration: 0.15 }, 0.6)
                .to(layers[2], { opacity: 1, y: 0, duration: 0.15 }, 0.6)
              if (progress)
                timeline.fromTo(
                  progress,
                  { scaleX: 0 },
                  { scaleX: 1, duration: 1, ease: "none" },
                  0
                )
            }
            return () => {
              delete root.dataset.scrollMotion
              delete root.dataset.storyStage
              steps.forEach((step) => {
                delete step.dataset.active
              })
            }
          },
          root
        )
      }
      configure()
      const observer = new MutationObserver(() => {
        const next = parseFloat(
          getComputedStyle(document.documentElement).fontSize
        )
        if (next === fontSize) return
        fontSize = next
        configure()
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "data-text-size"],
      })
      cleanup = () => {
        observer.disconnect()
        media.revert()
      }
      document.fonts.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh()
      })
    }
    void initialize().catch(() => {
      /* The server-rendered reading experience remains available. */
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [rootRef, language])
}
