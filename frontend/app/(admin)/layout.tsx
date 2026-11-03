import { ExperienceFrame } from "@/components/experience-nav"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ExperienceFrame label="Administration" items={[{ href: "/manage", label: "Documents" }, { href: "/", label: "Public site" }]}>{children}</ExperienceFrame>
}
