import Link from "next/link"

type Item = { href: string; label: string }

export function ExperienceNav({ label, items }: { label: string; items: Item[] }) {
  return (
    <header className="border-b border-border/70 bg-background/90">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="font-heading text-lg font-bold tracking-tight text-primary">Lingua Rakyat</Link>
        <nav aria-label={`${label} navigation`} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
          {items.map((item) => <Link key={item.href} href={item.href} className="text-foreground/75 transition-colors hover:text-primary">{item.label}</Link>)}
        </nav>
      </div>
    </header>
  )
}

export function ExperienceFrame({ label, items, children }: { label: string; items: Item[]; children: React.ReactNode }) {
  return <><ExperienceNav label={label} items={items} /><main>{children}</main></>
}
