// Strip markdown syntax so OG descriptions and card text read as plain text.
export function plainExcerpt(markdown: string, maxLength: number): string {
  const text = markdown
    .replace(/[#*_`>[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
