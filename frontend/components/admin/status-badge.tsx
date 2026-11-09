import { Badge } from "@/components/ui/badge"
import { UiText } from "@/components/i18n"

const TONES: Record<string, string> = {
  ready: "border-primary/40 bg-primary/10 text-primary",
  processing: "border-accent/40 bg-accent/10 text-accent-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  published: "border-primary/40 bg-primary/10 text-primary",
  approved: "border-accent/40 bg-accent/10 text-accent-foreground",
  review: "border-accent/40 bg-accent/10 text-accent-foreground",
  draft: "border-border bg-muted text-muted-foreground",
  suspended: "border-destructive/40 bg-destructive/10 text-destructive",
  archived: "border-border bg-muted text-muted-foreground",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  verified: "border-primary/40 bg-primary/10 text-primary",
  unverified: "border-border bg-muted text-muted-foreground",
  pending: "border-accent/40 bg-accent/10 text-accent-foreground",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  superseded: "border-border bg-muted text-muted-foreground",
  withdrawn: "border-destructive/40 bg-destructive/10 text-destructive",
  revoked: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function StatusBadge({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  const tone = TONES[value] ?? "border-border bg-muted text-muted-foreground"
  return (
    <Badge
      variant="outline"
      className={`h-auto min-h-5 max-w-full break-words whitespace-normal capitalize ${tone}`}
    >
      <UiText text={(label ?? value).replaceAll("_", " ")} />
    </Badge>
  )
}
