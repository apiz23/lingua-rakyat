"use client"

import dynamic from "next/dynamic"

const DemoVideo = dynamic(
  () => import("@/components/demo-video").then((module) => module.DemoVideo),
  { ssr: false }
)

export function LandingDemoPlayer({ src }: { src: string }) {
  return <DemoVideo src={src} />
}
