"use client"

import { cn } from "@/lib/utils"

export default function PageIntro({
  eyebrow,
  title,
  description,
  icon: Icon,
  badge,
  actions,
  children,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "border border-border bg-card px-6 py-8 sm:px-8",
        className
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl space-y-4">
          {(eyebrow || badge || Icon) && (
            <div className="flex flex-wrap items-center gap-3">
              {Icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary/20 bg-primary/5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              )}
              {eyebrow && (
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              )}
              {badge && (
                <span className="border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {badge}
                </span>
              )}
            </div>
          )}
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
        {actions && (
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto">
            {actions}
          </div>
        )}
      </div>
    </section>
  )
}