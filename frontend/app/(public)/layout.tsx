import { ExperienceNav } from "@/components/experience-nav"
export default function PublicLayout({ children }: { children: React.ReactNode }) {
 return <><ExperienceNav label="Public portal" items={[{href:"/",label:"Home"},{href:"/about",label:"About"},{href:"/results",label:"Results"}]} />{children}</>
}
