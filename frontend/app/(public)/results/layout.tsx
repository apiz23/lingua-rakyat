import type { Metadata } from "next"
import { ExperienceFrame } from "@/components/experience-nav"

export const metadata: Metadata = {
  title: "Project Showcase",
  description:
    "Lingua Rakyat showcase: the problem it solves, how the retrieval pipeline works, and measured evaluation results.",
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <ExperienceFrame label="Public portal" items={[{href:"/",label:"Home"},{href:"/about",label:"About"},{href:"/workspace",label:"Ask a question"}]}>{children}</ExperienceFrame>
}
