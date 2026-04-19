"use client"

import * as React from "react"
import { Paperclip, Send, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSubmit: (message: string) => void | Promise<void>
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  allowAttachments?: boolean
  className?: string

  value?: string
  onChange?: (value: string) => void
  clearOnSubmit?: boolean
  children?: React.ReactNode
  onAttachments?: (files: File[]) => void
}

const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSubmit,
      placeholder = "Type a message...",
      disabled = false,
      loading = false,
      allowAttachments = false,
      className,
      value,
      onChange,
      clearOnSubmit = true,
      children,
      onAttachments,
    },
    forwardedRef
  ) => {
  const [internalValue, setInternalValue] = React.useState("")
  const inputValue = value ?? internalValue

  const localTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useImperativeHandle(
    forwardedRef,
    () => localTextareaRef.current as HTMLTextAreaElement,
    []
  )

  const setValue = React.useCallback(
    (next: string) => {
      if (onChange) onChange(next)
      else setInternalValue(next)
    },
    [onChange]
  )

  const syncTextareaHeight = React.useCallback(() => {
    const el = localTextareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useEffect(() => {
    syncTextareaHeight()
  }, [inputValue, syncTextareaHeight])

  const doSubmit = React.useCallback(async () => {
    const message = inputValue.trim()
    if (!message) return
    if (disabled || loading) return

    await onSubmit(message)

    if (clearOnSubmit) {
      setValue("")
      requestAnimationFrame(() => syncTextareaHeight())
    }
  }, [
    clearOnSubmit,
    disabled,
    inputValue,
    loading,
    onSubmit,
    setValue,
    syncTextareaHeight,
  ])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return

    if (e.shiftKey) return

    // ChatGPT/Claude style: Enter submits. Also allow Cmd/Ctrl+Enter.
    e.preventDefault()
    void doSubmit()
  }

  const handlePickAttachment = () => {
    fileInputRef.current?.click()
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    onAttachments?.(files)
    e.target.value = ""
  }

  return (
    <div
      data-slot="chat-input"
      className={cn(
        "rounded-2xl border border-border/50 bg-card shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-md",
        className
      )}
    >
      <textarea
        ref={localTextareaRef}
        value={inputValue}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled || loading}
        className="max-h-32 w-full resize-none rounded-2xl bg-transparent px-3 py-3 text-sm focus:outline-none sm:px-4 sm:py-4"
      />

      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleAttachmentChange}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handlePickAttachment}
                disabled={disabled || loading}
                className="shrink-0 rounded-xl"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}

          {children}
        </div>

        <Button
          type="button"
          onClick={() => void doSubmit()}
          disabled={disabled || loading || !inputValue.trim()}
          className="shrink-0 rounded-xl"
          size="icon-sm"
          title="Send"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
  }
)

ChatInput.displayName = "ChatInput"

export { ChatInput }
export type { ChatInputProps }
