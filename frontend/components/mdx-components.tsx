/**
 * mdx-components.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global MDX component overrides for DocuQuery.
 *
 * These components are used BOTH by:
 *   1. Next.js MDX pages (required by @next/mdx with App Router)
 *   2. The <MdxRenderer> component in chat-panel.tsx, which passes these
 *      same components to ReactMarkdown so AI responses are styled
 *      consistently with the rest of the app.
 *
 * Design principles (Case Study 4 — Inclusive Citizen):
 *   • SHORT  — max 3–5 bullet points, no long paragraphs
 *   • SIMPLE — plain everyday language, no jargon
 *   • GROUNDED — only from the document
 *   • ACTIONABLE — tells the citizen what they can do
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MDXComponents } from "mdx/types"
import { Quote, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Shared token ─────────────────────────────────────────────────────────────
const prose =
  "text-sm leading-relaxed text-foreground/90"

// ─── Component map ────────────────────────────────────────────────────────────
const components: MDXComponents = {
  // ── Headings ────────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
      <Hash className="h-4 w-4 shrink-0 text-primary" />
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold text-foreground first:mt-0">
      <span className="h-1 w-3 rounded-full bg-primary" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground/80 first:mt-0">
      {children}
    </h3>
  ),

  // ── Paragraph ───────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p className={cn(prose, "mb-2 last:mb-0")}>{children}</p>
  ),

  // ── Unordered list — styled pill bullets ────────────────────────────────────
  ul: ({ children }) => (
    <ul className="my-3 list-none space-y-2 pl-0">{children}</ul>
  ),

  // ── Ordered list ────────────────────────────────────────────────────────────
  ol: ({ children }) => (
    <ol className="my-3 list-none space-y-2 pl-0">{children}</ol>
  ),

  // ── List item — pill card style ──────────────────────────────────────────────
  li: ({ children }) => (
    <li className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
      <span className="mt-0.5 shrink-0 font-bold text-primary">•</span>
      <span className={cn(prose, "leading-relaxed")}>{children}</span>
    </li>
  ),

  // ── Blockquote — action sentence callout ────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-primary/40 bg-primary/5 px-4 py-2.5 text-sm text-foreground/70 italic">
      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/50" />
      <span>{children}</span>
    </blockquote>
  ),

  // ── Inline code ─────────────────────────────────────────────────────────────
  code: ({ children, className }) => {
    // Block code (has a language class like "language-js")
    if (className) {
      return (
        <code
          className={cn(
            "block w-full overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground/80",
            className
          )}
        >
          {children}
        </code>
      )
    }
    // Inline code
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
        {children}
      </code>
    )
  },

  // ── Pre (wraps block code) ───────────────────────────────────────────────────
  pre: ({ children }) => (
    <pre className="my-3 overflow-hidden rounded-lg border border-border bg-muted">
      {children}
    </pre>
  ),

  // ── Horizontal rule ─────────────────────────────────────────────────────────
  hr: () => <hr className="my-4 border-border/60" />,

  // ── Bold / Strong ───────────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  // ── Italic / Em ─────────────────────────────────────────────────────────────
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),

  // ── Links ───────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),

  // ── Table ───────────────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60 text-xs font-semibold text-foreground/70">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/50">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="transition-colors hover:bg-muted/20">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-foreground/80">{children}</td>
  ),
}

export function useMDXComponents(overrides?: MDXComponents): MDXComponents {
  return { ...components, ...overrides }
}

export { components as mdxComponents }
