"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { usePathname } from "@/components/i18n"

import { useAuth, UserButton } from "@clerk/nextjs"
import Image from "next/image"
import { useLanguage } from "@/components/language-provider"
import { LocalizedLink as Link } from "@/components/i18n"

type Item = { href: string; label: string }

export function ExperienceNav({
  label,
  items,
}: {
  label: string
  items: Item[]
}) {
  const t = useTranslations()

  const { language, setLanguage } = useLanguage()
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()
  return (
    <header className="border-b border-border/70 bg-background/90">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-w-0 shrink-0 items-center gap-2.5 rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Image
            src="/icons/android-chrome-512x512.png"
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg object-contain"
            priority
          />
          <span className="truncate font-heading text-base font-bold tracking-tight sm:text-lg">
            <UiText text="Lingua Rakyat" />
          </span>
        </Link>
        <nav
          aria-label={t("{value0} navigation", { value0: t(label) })}
          className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-2 text-sm sm:order-none sm:w-auto sm:border-0 sm:pt-0"
        >
          {label !== "Public portal" && label !== "Portal awam" ? (
            <span className="hidden text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase lg:inline">
              <UiText text={label} />
            </span>
          ) : null}
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="text-foreground/75 underline-offset-8 transition-colors hover:text-primary aria-[current=page]:text-primary aria-[current=page]:underline"
            >
              {<UiText text={item.label} />}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setLanguage(language === "ms" ? "en" : "ms")}
            aria-label={
              language === "ms"
                ? t("Switch to English")
                : t("Tukar ke Bahasa Melayu")
            }
            className="rounded-md border border-border px-2 py-1 text-xs font-medium"
          >
            {language === "ms" ? t("EN") : t("BM")}
          </button>
          {isLoaded &&
            (isSignedIn ? (
              <>
                {(label === "Public portal" || label === "Portal awam") && (
                  <Link href="/workspace">
                    <UiText text="My workspace" />
                  </Link>
                )}
                <UserButton />
              </>
            ) : (
              <Link href="/sign-in">
                <UiText text="Sign in" />
              </Link>
            ))}
        </div>
      </div>
    </header>
  )
}

export function ExperienceFrame({
  label,
  items,
  children,
}: {
  label: string
  items: Item[]
  children: React.ReactNode
}) {
  return (
    <>
      <ExperienceNav label={label} items={items} />
      <main>{children}</main>
    </>
  )
}
