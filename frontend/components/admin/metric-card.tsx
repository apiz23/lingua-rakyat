import { UiText } from "@/components/i18n"
import { LocalizedLink as Link } from "@/components/i18n"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricCell({
  index,
  label,
  value,
  href,
  hint,
  tone = "default",
  span = "default",
}: {
  index: number
  label: string
  value: number | string
  href: string
  hint?: string
  tone?: "default" | "warning" | "danger" | "success"
  span?: "default" | "lead" | "half" | "wide"
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-primary"
          : "text-foreground"

  return (
    <Link
      href={href}
      className={cn(
        "group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        (span === "lead" || span === "half") && "sm:col-span-2"
      )}
    >
      <Card
        className="h-full gap-3 transition-colors group-hover:bg-muted/50"
        size="sm"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardDescription className="min-w-0 font-medium">
            <UiText text={label} />
          </CardDescription>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2">
          <p
            className={cn(
              "font-heading text-3xl font-semibold tracking-tight tabular-nums",
              toneClass
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <UiText text={hint} />
            </p>
          ) : null}
          <span className="mt-auto pt-2 text-xs font-medium text-muted-foreground group-hover:text-primary">
            <UiText text="Open" /> <span aria-hidden>→</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
