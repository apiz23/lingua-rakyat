"use client"

import type { Components } from "react-markdown"
import { Markdown } from "@/components/markdown"

type WritingBlock = {
  type: "writing"
  content: string
  attrs: {
    variant?: string
    id?: string
    subject?: string
  }
}

type MarkdownBlock = {
  type: "markdown"
  content: string
}

type ChatContentBlock = WritingBlock | MarkdownBlock

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
      <span className="h-6 w-1 rounded-full bg-primary" />
      {props.children}
    </h1>
  ),
  h2: (props) => (
    <h2 className="mt-4 mb-3 text-lg font-semibold text-foreground/90 first:mt-0">
      {props.children}
    </h2>
  ),
  h3: (props) => (
    <h3 className="mt-3 mb-2 text-base font-medium text-foreground/80">
      {props.children}
    </h3>
  ),
  p: (props) => (
    <p className="mb-3 text-sm leading-relaxed text-foreground/80 last:mb-0">
      {props.children}
    </p>
  ),
  ul: (props) => <ul className="my-4 space-y-2.5">{props.children}</ul>,
  ol: (props) => (
    <ol className="my-4 list-decimal space-y-2.5 pl-4">{props.children}</ol>
  ),
  li: (props) => (
    <li className="flex items-start gap-3 border border-border/50 bg-muted/30 p-3 text-sm">
      <span className="mt-0.5 shrink-0 text-primary">•</span>
      <span className="text-foreground/80">{props.children}</span>
    </li>
  ),
  blockquote: (props) => (
    <blockquote className="my-4 border-l-4 border-primary/40 bg-primary/5 py-2 pr-4 pl-4 text-sm text-foreground/70 italic">
      {props.children}
    </blockquote>
  ),
  code: (props) => {
    const { className, children, ...rest } = props
    const isInline = !className

    if (isInline) {
      return (
        <code className="border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
          {children}
        </code>
      )
    }

    return (
      <pre className="my-4 overflow-x-auto border border-border/50 bg-muted p-4 font-mono text-xs text-foreground/80">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    )
  },
  a: (props) => (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
    >
      {props.children}
    </a>
  ),
  table: (props) => (
    <div className="my-4 overflow-x-auto border border-border">
      <table className="w-full text-sm">{props.children}</table>
    </div>
  ),
  th: (props) => (
    <th className="bg-muted/50 px-4 py-2 text-left font-semibold">
      {props.children}
    </th>
  ),
  td: (props) => (
    <td className="border-t border-border/50 px-4 py-2">{props.children}</td>
  ),
  hr: (props) => <hr className="my-6 border-border/30" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-foreground">{props.children}</strong>
  ),
  em: (props) => (
    <em className="text-foreground/70 italic">{props.children}</em>
  ),
}

function parseWritingAttrs(rawAttrs: string) {
  const attrs: WritingBlock["attrs"] = {}
  const attrRegex = /(\w+)="([^"]*)"/g

  for (const match of rawAttrs.matchAll(attrRegex)) {
    const [, key, value] = match
    attrs[key as keyof WritingBlock["attrs"]] = value
  }

  return attrs
}

function parseChatContent(content: string): ChatContentBlock[] {
  const blocks: ChatContentBlock[] = []
  const writingRegex = /:::writing\{([^}]*)\}\s*([\s\S]*?):::/g
  let lastIndex = 0

  for (const match of content.matchAll(writingRegex)) {
    const matchIndex = match.index ?? 0
    const markdownBefore = content.slice(lastIndex, matchIndex)

    if (markdownBefore.trim()) {
      blocks.push({ type: "markdown", content: markdownBefore })
    }

    blocks.push({
      type: "writing",
      content: match[2].trim(),
      attrs: parseWritingAttrs(match[1]),
    })

    lastIndex = matchIndex + match[0].length
  }

  const trailingMarkdown = content.slice(lastIndex)
  if (trailingMarkdown.trim() || blocks.length === 0) {
    blocks.push({ type: "markdown", content: trailingMarkdown })
  }

  return blocks
}

function WritingBlockCard({ block }: { block: WritingBlock }) {
  const variant = block.attrs.variant ?? "writing"
  const subject = block.attrs.subject?.trim()
  const id = block.attrs.id?.trim()

  return (
    <div
      className="my-4 overflow-hidden border border-primary/20 bg-primary/[0.04]"
      data-writing-variant={variant}
      data-writing-id={id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-primary/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="border border-primary/20 bg-background/70 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            {variant}
          </span>
          {id ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              #{id}
            </span>
          ) : null}
        </div>
        {subject ? (
          <span className="text-xs font-medium text-foreground">{subject}</span>
        ) : null}
      </div>

      <div className="px-4 py-4">
        <div className="rounded-md border border-border/50 bg-background/70 px-4 py-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
          {block.content}
        </div>
      </div>
    </div>
  )
}

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = parseChatContent(content)

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {blocks.map((block, index) =>
        block.type === "writing" ? (
          <WritingBlockCard
            key={`${block.attrs.id ?? block.attrs.subject ?? "writing"}-${index}`}
            block={block}
          />
        ) : (
          <Markdown
            key={`markdown-${index}`}
            components={markdownComponents}
            className="contents"
          >
            {block.content}
          </Markdown>
        )
      )}
    </div>
  )
}
