"use client"

import { UiText } from "@/components/i18n"
import { Button } from "@/components/ui/button"
export default function RouteError({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="mx-auto my-12 max-w-xl space-y-4 rounded-lg border border-border bg-card p-6"
    >
      <h1 className="font-heading text-2xl font-semibold">
        <UiText text="This page could not load" />
      </h1>
      <p className="text-sm text-muted-foreground">
        <UiText text="Please try again. If the problem continues, return later." />
      </p>
      <Button type="button" onClick={reset}>
        <UiText text="Try again" />
      </Button>
    </section>
  )
}
