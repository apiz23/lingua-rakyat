"use client"

import { cn } from "@/lib/utils"

export default function PageIntro({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <div className="bg-[radial-linear(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-linear(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_26%)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/15">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
                {eyebrow}
              </p>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>
          </div>

          {actions && (
            <div className="flex w-full flex-col gap-3 lg:w-auto">
              {actions}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
