"use client"

import { useState } from "react"
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
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)

  const changeOpen = (next: boolean) => {
    if (!next) {
      setReason("")
      setTouched(false)
    }
    onOpenChange(next)
  }

  const blocked = Boolean(requireReason && !reason.trim())

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="action-reason" className="text-sm font-medium">
            {requireReason ? "Reason (required)" : "Reason (optional)"}
          </label>
          <Textarea
            id="action-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setTouched(true)
            }}
            placeholder="Recorded in the audit log and publication events."
            maxLength={2000}
            aria-invalid={touched && blocked}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => changeOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy || blocked}
            onClick={() => void onConfirm(reason.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
