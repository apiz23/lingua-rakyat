"use client"

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

interface DemoVideoProps {
  src: string
}

export function DemoVideo({ src }: DemoVideoProps) {
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:hidden">
        <MediaPlayer className="aspect-video w-full rounded-none">
          <MediaPlayerVideo className="h-full w-full object-cover">
            <source src={src} type="video/mp4" />
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
        <Safari
          url="lingua-rakyat.my"
          className="w-full drop-shadow-xl"
        />
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
            <MediaPlayerVideo className="h-full w-full object-cover">
              <source src={src} type="video/mp4" />
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
      <div className="pointer-events-none absolute -bottom-6 right-0 z-30 hidden w-[17%] max-w-[180px] md:block lg:-right-2">
        <Iphone
          videoSrc={src}
          className="drop-shadow-2xl"
        />
      </div>
    </>
  )
}