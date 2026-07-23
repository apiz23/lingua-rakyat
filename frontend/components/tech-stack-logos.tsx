"use client"

import LogoCarousel from "@/components/ui/logo-carousel"
import { Backlight } from "@/components/ui/backlight"
import { LinkPreview } from "@/components/ui/link-preview"
import { useMobile } from "@/hooks/use-mobile"

interface TechStackLogosProps {
  techs: { name: string; url: string }[]
}

export function TechStackLogos({ techs }: TechStackLogosProps) {
  const isMobile = useMobile()

  return (
    <>
      <div className="mt-6 mb-8 flex flex-wrap justify-center gap-2 sm:mt-8 sm:mb-12 sm:gap-3">
        {techs.map((tech) => (
          <LinkPreview key={tech.name} url={tech.url}>
            <span
              className="inline-block cursor-pointer rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary hover:shadow-sm sm:px-5 sm:py-2 sm:text-sm"
            >
              {tech.name}
            </span>
          </LinkPreview>
        ))}
      </div>

      <div className="mt-6 w-full overflow-x-hidden sm:mt-8">
        <div className="relative w-full">
          <Backlight blur={6}>
            <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 flex justify-center overflow-x-auto overflow-y-visible pb-4">
              <div className="min-w-[300px]">
                <LogoCarousel columnCount={isMobile ? 3 : 4} />
              </div>
            </div>
          </Backlight>
        </div>
      </div>
    </>
  )
}