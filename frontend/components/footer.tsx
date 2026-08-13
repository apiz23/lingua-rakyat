"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight, FolderOpen, LayoutDashboard, Sparkles, TrendingUp } from "lucide-react"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"
import { useLanguage } from "./language-provider"
import logo from "@/public/icons/android-chrome-512x512.png"

export default function Footer() {
  const { language } = useLanguage()

  const ms = language === "ms"

  const copy = {
    brand: "Lingua Rakyat",
    tagline: ms
      ? "AI berbilang bahasa untuk memahami dokumen kerajaan."
      : "Multilingual AI for understanding government documents.",
    product: ms ? "Produk" : "Product",
    resources: ms ? "Sumber" : "Resources",
    home: ms ? "Utama" : "Home",
    workspace: "Workspace",
    manage: ms ? "Urus Dokumen" : "Manage Documents",
    results: ms ? "Pameran" : "Results",
    about: ms ? "Tentang" : "About",
    github: "GitHub",
    linkedin: "LinkedIn",
  }

  const columns = [
    {
      title: copy.product,
      items: [
        { label: copy.home, href: "/", icon: LayoutDashboard },
        { label: copy.workspace, href: "/workspace", icon: FolderOpen },
        { label: copy.manage, href: "/manage", icon: Sparkles },
        { label: copy.results, href: "/results", icon: TrendingUp },
      ],
    },
    {
      title: copy.resources,
      items: [
        { label: copy.about, href: "/about", icon: ArrowUpRight },
        {
          label: copy.github,
          href: "https://github.com/apiz23/lingua-rakyat",
          icon: ArrowUpRight,
          external: true,
        },
        {
          label: copy.linkedin,
          href: "https://www.linkedin.com/in/muh-hafizuddin/",
          icon: ArrowUpRight,
          external: true,
        },
      ],
    },
  ]

  return (
    <footer className="w-full border-t-2 border-foreground bg-background/50 text-foreground backdrop-blur-sm">
      <div className="mx-auto w-full max-w-full px-5 py-10 sm:px-8 lg:max-w-[70%] lg:px-10">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src={logo}
                alt="Lingua Rakyat"
                width={32}
                height={32}
                priority
                className="h-8 w-8 shrink-0 rounded-full border-2 border-foreground object-cover"
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-sm leading-none font-bold tracking-[0.22em] uppercase">
                  {copy.brand}
                </span>
                <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Civic AI
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {copy.tagline}
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <Link
                href="https://github.com/apiz23/lingua-rakyat"
                aria-label="GitHub"
                className="flex h-10 w-10 items-center justify-center border-2 border-foreground/70 text-foreground transition-all duration-150 hover:border-foreground hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <GithubIcon size={18} />
              </Link>
              <Link
                href="https://www.linkedin.com/in/muh-hafizuddin/"
                aria-label="LinkedIn"
                className="flex h-10 w-10 items-center justify-center border-2 border-foreground/70 text-foreground transition-all duration-150 hover:border-foreground hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <LinkedinIcon size={18} />
              </Link>
              <span aria-hidden="true" className="mx-1 hidden text-muted-foreground/60 sm:inline">
                /
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {copy.tagline}
              </span>
            </div>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-heading text-xs font-bold tracking-[0.22em] text-muted-foreground uppercase">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="group inline-flex items-center gap-1.5 text-sm text-foreground/85 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  )
}