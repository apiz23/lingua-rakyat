"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  requireReason,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  requireReason?: boolean
  busy?: boolean
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const t = useTranslations()

  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)

  const changeOpen = (next: boolean) => {
    if (busy) return
    if (!next) {
      setReason("")
      setTouched(false)
    }
    onOpenChange(next)
  }

  const blocked = Boolean(requireReason && !reason.trim())

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (blocked) return
    void onConfirm(reason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent aria-busy={busy} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{<UiText text={title} />}</DialogTitle>
          {description ? (
            <DialogDescription>
              {<UiText text={description} />}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field data-invalid={touched && blocked}>
              <FieldLabel htmlFor="action-reason">
                {requireReason
                  ? t("Reason (required)")
                  : t("Reason (optional)")}
              </FieldLabel>
              <Textarea
                id="action-reason"
                className="max-h-48 min-h-24 resize-y"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                  setTouched(true)
                }}
                placeholder={t(
                  "Recorded in the audit log and publication events."
                )}
                maxLength={2000}
                disabled={busy}
                required={requireReason}
                aria-describedby={
                  touched && blocked
                    ? "action-reason-error"
                    : "action-reason-help"
                }
                aria-invalid={touched && blocked}
              />
              <FieldDescription id="action-reason-help">
                <UiText text="Reasons are recorded in the audit log." />
              </FieldDescription>
              {touched && blocked ? (
                <FieldError id="action-reason-error">
                  <UiText text="Enter a reason before confirming." />
                </FieldError>
              ) : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
              disabled={busy}
            >
              <UiText text="Cancel" />
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={busy || blocked}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <UiText text={confirmLabel} />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
