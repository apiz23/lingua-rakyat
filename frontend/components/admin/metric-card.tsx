import { UiText } from "@/components/i18n"
import { LocalizedLink as Link } from "@/components/i18n"

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

  const spanClass =
    span === "lead"
      ? "admin-ledger__cell--lead"
      : span === "half"
        ? "admin-ledger__cell--half"
        : span === "wide"
          ? "admin-ledger__cell--wide"
          : ""

  return (
    <Link href={href} className={`admin-ledger__cell ${spanClass} group`}>
      <span className="admin-ledger__label">
        <span>{<UiText text={label} />}</span>
        <span className="admin-index">{String(index).padStart(2, "0")}</span>
      </span>
      <span className={`admin-ledger__value ${toneClass}`}>{value}</span>
      {hint ? (
        <span className="text-[11px] leading-snug text-muted-foreground">
          {<UiText text={hint} />}
        </span>
      ) : null}
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
        {" "}
        <UiText text="Open" /> <span aria-hidden>→</span>
      </span>
    </Link>
  )
}
