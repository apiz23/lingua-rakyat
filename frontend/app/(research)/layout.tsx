import { ExperienceFrame } from "@/components/experience-nav"

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <ExperienceFrame label="Research" items={[{ href: "/eval", label: "Evaluation" }, { href: "/benchmark", label: "Benchmarks" }]}>{children}</ExperienceFrame>
}
