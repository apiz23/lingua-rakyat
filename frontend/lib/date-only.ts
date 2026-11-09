import { format, isValid, parseISO } from "date-fns"

/** Date-only values represent a local calendar day, never a UTC timestamp. */
export function parseDateOnly(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = parseISO(value)
  return isValid(date) ? date : undefined
}

export function formatDateOnly(date: Date): string {
  return isValid(date) ? format(date, "yyyy-MM-dd") : ""
}
