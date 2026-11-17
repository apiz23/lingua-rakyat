"use client"

import { useState } from "react"
import { useLanguage } from "@/components/language-provider"
import { LocalizedLink as Link } from "@/components/i18n"
import { Button } from "@/components/ui/button"
import { FileVideo } from "lucide-react"
import {
  MediaPlayer,
  MediaPlayerVideo,
  MediaPlayerControls,
  MediaPlayerControlsOverlay,
  MediaPlayerPlay,
  MediaPlayerSeekBackward,
  MediaPlayerSeekForward,
  MediaPlayerVolume,
  MediaPlayerSeek,
  MediaPlayerTime,
  MediaPlayerPlaybackSpeed,
  MediaPlayerFullscreen,
  MediaPlayerPiP,
} from "@/components/ui/media-player"
import { Safari } from "@/components/ui/safari"
import { Iphone } from "@/components/ui/iphone"
import mobileWallpaper from "@/assets/mobile-wallpaper.png"

interface DemoVideoProps {
  src: string
}

export function DemoVideo({ src }: DemoVideoProps) {
  const [unavailable, setUnavailable] = useState(false)
  const { language } = useLanguage()
  if (unavailable) {
    return (
      <div
        role="status"
        className="flex min-h-72 flex-col items-center justify-center gap-5 rounded-xl bg-secondary px-6 py-12 text-center text-secondary-foreground"
      >
        <FileVideo aria-hidden="true" className="size-8" strokeWidth={1.5} />
        <p>
          {language === "ms"
            ? "Video demo tidak tersedia buat masa ini."
            : "The demo video is currently unavailable."}
        </p>
        <Button asChild size="lg">
          <Link href="/workspace">
            {language === "ms" ? "Tanya soalan" : "Ask a question"}
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <>
      <div className="neo-card overflow-hidden bg-card sm:hidden">
        <MediaPlayer className="aspect-video w-full rounded-none">
          <MediaPlayerVideo
            preload="none"
            onError={() => setUnavailable(true)}
            className="h-full w-full object-cover"
          >
            <source
              src={src}
              type="video/mp4"
              onError={() => setUnavailable(true)}
            />
          </MediaPlayerVideo>
          <MediaPlayerControls className="flex-col items-start gap-2">
            <MediaPlayerControlsOverlay />
            <MediaPlayerSeek />
            <div className="flex w-full items-center gap-1.5 px-1">
              <MediaPlayerPlay />
              <MediaPlayerTime />
              <div className="ml-auto flex items-center gap-1.5">
                <MediaPlayerFullscreen />
              </div>
            </div>
          </MediaPlayerControls>
        </MediaPlayer>
      </div>

      <div className="relative hidden sm:block">
        <Safari url="lingua-rakyat.my" className="w-full drop-shadow-xl" />
        <div
          className="absolute z-20 overflow-hidden"
          style={{
            left: "0.0831%",
            top: "6.9058%",
            width: "99.7506%",
            height: "92.9615%",
          }}
        >
          <MediaPlayer className="h-full w-full rounded-none">
            <MediaPlayerVideo
              preload="none"
              onError={() => setUnavailable(true)}
              className="h-full w-full object-cover"
            >
              <source
                src={src}
                type="video/mp4"
                onError={() => setUnavailable(true)}
              />
            </MediaPlayerVideo>
            <MediaPlayerControls className="flex-col items-start gap-2.5">
              <MediaPlayerControlsOverlay />
              <MediaPlayerSeek />
              <div className="flex w-full flex-wrap items-center gap-2 px-2 sm:px-0">
                <div className="flex flex-1 flex-wrap items-center gap-1 sm:gap-2">
                  <MediaPlayerPlay />
                  <MediaPlayerSeekBackward />
                  <MediaPlayerSeekForward />
                  <MediaPlayerVolume expandable />
                  <MediaPlayerTime />
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <MediaPlayerPlaybackSpeed />
                  <MediaPlayerPiP />
                  <MediaPlayerFullscreen />
                </div>
              </div>
            </MediaPlayerControls>
          </MediaPlayer>
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 -bottom-6 z-30 hidden w-[17%] max-w-[180px] md:block lg:-right-2">
        <Iphone src={mobileWallpaper.src} className="drop-shadow-2xl" />
      </div>
    </>
  )
}
