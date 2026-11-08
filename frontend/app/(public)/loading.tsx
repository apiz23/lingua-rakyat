import { UiText } from "@/components/i18n"
export default function Loading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-7xl px-4 py-12 text-sm text-muted-foreground"
    >
      <UiText text="Loading Lingua Rakyat?" />
    </div>
  )
}
