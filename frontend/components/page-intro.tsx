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
        "overflow-hidden border border-border bg-card/40 backdrop-blur-sm shadow-sm",
        className
      )}
    >
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3">
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
