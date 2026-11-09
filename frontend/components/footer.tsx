"use client"

import Image from "next/image"
import { ArrowUpRight } from "lucide-react"

import { LocalizedLink as Link, UiText } from "@/components/i18n"
import { useLanguage } from "./language-provider"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"
import logo from "@/public/icons/android-chrome-512x512.png"

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/apiz23/lingua-rakyat",
    Icon: GithubIcon,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/muh-hafizuddin/",
    Icon: LinkedinIcon,
  },
]

export default function Footer() {
  const { language } = useLanguage()
  const ms = language === "ms"
  const copy = {
    tagline: ms
      ? "Fahami maklumat awam dalam bahasa anda."
      : "Understand public information in your language.",
    product: ms ? "Teroka" : "Explore",
    resources: ms ? "Tentang kami" : "About",
    home: ms ? "Utama" : "Home",
    workspace: ms ? "Ruang kerja" : "Workspace",
    results: ms ? "Keputusan" : "Results",
    about: ms ? "Tentang Lingua Rakyat" : "About Lingua Rakyat",
    copyright: ms ? "Hak cipta terpelihara." : "All rights reserved.",
    note: ms
      ? "Dibina untuk akses maklumat berbilang bahasa."
      : "Built for multilingual access to information.",
  }

  const columns = [
    {
      title: copy.product,
      items: [
        { label: copy.home, href: "/" },
        { label: copy.workspace, href: "/workspace" },
        { label: copy.results, href: "/results" },
      ],
    },
    {
      title: copy.resources,
      items: [{ label: copy.about, href: "/about" }],
    },
  ]

  return (
    <footer className="w-full border-t border-border bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-9 sm:px-6 sm:py-11 lg:px-8">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(9rem,0.6fr))] lg:gap-12">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Image
                src={logo}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0"
              />
              <span className="font-heading text-base font-bold tracking-tight">
                <UiText text="Lingua Rakyat" />
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {copy.tagline}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {socialLinks.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icon size={17} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <nav
              key={column.title}
              aria-label={column.title}
              className="min-w-0"
            >
              <h2 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-8 items-center rounded-sm py-1 text-sm text-foreground/80 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} <UiText text="Lingua Rakyat." />{" "}
            {copy.copyright}
          </p>
          <p className="flex items-center gap-1">
            {copy.note}
            <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
          </p>
        </div>
      </div>
    </footer>
  )
}
