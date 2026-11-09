"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { enGB, ms } from "react-day-picker/locale"
import type { Matcher } from "react-day-picker"

import { useTranslations } from "@/components/i18n"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDateOnly, parseDateOnly } from "@/lib/date-only"
import { cn } from "@/lib/utils"

type DatePickerProps = Omit<
  React.ComponentProps<typeof Button>,
  "value" | "onChange" | "children"
> & {
  value?: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

export function DatePicker({
  value = "",
  onChange,
  min,
  max,
  className,
  disabled,
  ...props
}: DatePickerProps) {
  const t = useTranslations()
  const [open, setOpen] = React.useState(false)
  const selected = parseDateOnly(value)
  const minimum = parseDateOnly(min)
  const maximum = parseDateOnly(max)
  const today = new Date()
  const disabledDates: Matcher[] = []
  if (minimum) disabledDates.push({ before: minimum })
  if (maximum) disabledDates.push({ after: maximum })

  const initialMonth =
    selected ??
    (maximum && today > maximum
      ? maximum
      : minimum && today < minimum
        ? minimum
        : today)
  const display = selected
    ? new Intl.DateTimeFormat(t.locale === "ms" ? "ms-MY" : "en-GB", {
        dateStyle: "medium",
      }).format(selected)
    : t("Pick a date")

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          {...props}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "w-full min-w-0 justify-start text-left data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          <span className="truncate" title={display}>
            {display}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t("Pick a date")}
        collisionPadding={16}
        className="max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0"
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={initialMonth}
          onSelect={(date) => {
            onChange(date ? formatDateOnly(date) : "")
            setOpen(false)
          }}
          disabled={disabledDates}
          locale={t.locale === "ms" ? ms : enGB}
          captionLayout="dropdown"
          startMonth={
            minimum ??
            new Date(
              Math.min(initialMonth.getFullYear(), today.getFullYear() - 100),
              0
            )
          }
          endMonth={
            maximum ??
            new Date(
              Math.max(initialMonth.getFullYear(), today.getFullYear() + 100),
              11
            )
          }
          labels={{
            labelPrevious: () => t("Previous month"),
            labelNext: () => t("Next month"),
            labelMonthDropdown: () => t("Month"),
            labelYearDropdown: () => t("Year"),
          }}
          autoFocus
        />
        <div className="flex justify-end border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!selected}
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
          >
            {t("Clear date")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
