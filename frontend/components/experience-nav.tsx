"use client"

import { usePathname } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import { useLanguage } from "@/components/language-provider"
import Link from "next/link"

type Item = { href: string; label: string }

export function ExperienceNav({
  label,
  items,
}: {
  label: string
  items: Item[]
}) {
  const { language, setLanguage } = useLanguage()
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()
  return (
    <header className="border-b border-border/70 bg-background/90">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-heading text-lg font-bold tracking-tight text-primary"
        >
          Lingua Rakyat
        </Link>
        <nav
          aria-label={`${label} navigation`}
          className="order-3 flex w-full items-center gap-x-5 gap-y-2 border-t border-border pt-2 text-sm sm:order-none sm:w-auto sm:border-0 sm:pt-0"
        >
          <span className="hidden text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase lg:inline">
            {label}
          </span>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="text-foreground/75 underline-offset-8 transition-colors hover:text-primary aria-[current=page]:text-primary aria-[current=page]:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setLanguage(language === "ms" ? "en" : "ms")}
            aria-label={
              language === "ms" ? "Switch to English" : "Tukar ke Bahasa Melayu"
            }
            className="rounded-md border border-border px-2 py-1 text-xs font-medium"
          >
            {language === "ms" ? "EN" : "BM"}
          </button>
          {isLoaded &&
            (isSignedIn ? (
              <>
                {label === "Public portal" && (
                  <Link href="/workspace">My workspace</Link>
                )}
                <Link
                  href="/manage"
                  className="text-xs font-medium hover:text-primary"
                >
                  Administration
                </Link>
                <UserButton />
              </>
            ) : (
              <Link href="/sign-in">Sign in</Link>
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
