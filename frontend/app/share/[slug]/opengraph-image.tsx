import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getShare } from "@/lib/api"
import { plainExcerpt } from "./share-text"

export const alt = "Shared answer from Lingua Rakyat"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const GREEN = "#14532d"
const PAPER = "#f5f3ec"
const MINT = "#bbf7d0"
const AMBER = "#d97706"

const CHIP_LABELS: Record<string, Record<string, string>> = {
  en: { high: "High match", medium: "Medium match", low: "Low match — verify" },
  ms: { high: "Padanan tinggi", medium: "Padanan sederhana", low: "Padanan rendah — sila sahkan" },
  zh: { high: "匹配度高", medium: "匹配度中", low: "匹配度低 — 请核实" },
}

function chipFor(label: string, language: string) {
  if (!label) return null
  const lang = language.startsWith("zh") ? "zh" : language.startsWith("ms") || language.startsWith("id") ? "ms" : "en"
  const text = CHIP_LABELS[lang][label] ?? CHIP_LABELS.en[label]
  if (!text) return null
  // high: mint on deep green; medium: paper on translucent; low: amber
  const style =
    label === "high"
      ? { backgroundColor: "#166534", color: MINT }
      : label === "low"
        ? { backgroundColor: AMBER, color: "#1c1207" }
        : { backgroundColor: "rgba(245,243,236,0.16)", color: PAPER }
  return { text, style }
}

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const data = await readFile(join(process.cwd(), "assets/bricolage-700.woff"))
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  } catch {
    return null // fall back to system sans — never fail the image
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [data, font] = await Promise.all([getShare(slug), loadFont()])

  const question = data ? plainExcerpt(data.question, 90) : "Shared answer"
  const answer = data ? plainExcerpt(data.answer, 200) : ""
  const agency = data?.agency ?? ""
  const chip = data ? chipFor(data.confidence_label ?? "", data.language ?? "en") : null
  const topSource = data?.sources?.[0]
  const docName = topSource?.doc_name ? topSource.doc_name.replace(/\.pdf$/i, "") : ""
  const page = topSource?.page_start

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: GREEN,
          padding: "56px 72px",
          color: "#ffffff",
          fontFamily: font ? "Bricolage" : "sans-serif",
        }}
      >
        {/* Top row: wordmark + agency badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 1, display: "flex" }}>
            Lingua Rakyat
          </div>
          {agency ? (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                padding: "10px 26px",
                borderRadius: 999,
                backgroundColor: PAPER,
                color: GREEN,
              }}
            >
              {agency}
            </div>
          ) : null}
        </div>

        {/* Middle: question label + question + answer excerpt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: MINT,
              display: "flex",
            }}
          >
            {question}
          </div>
          <div
            style={{
              fontSize: answer.length > 120 ? 40 : 48,
              fontWeight: 700,
              lineHeight: 1.25,
              color: PAPER,
              display: "flex",
            }}
          >
            {answer || question}
          </div>
        </div>

        {/* Bottom row: doc pill + chip + domain */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {docName ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  padding: "10px 22px",
                  borderRadius: 999,
                  backgroundColor: "rgba(245,243,236,0.14)",
                  color: PAPER,
                }}
              >
                {docName}
                {page ? ` · p.${page}` : ""}
              </div>
            ) : null}
            {chip ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 700,
                  padding: "10px 22px",
                  borderRadius: 999,
                  ...chip.style,
                }}
              >
                {chip.text}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: MINT }}>lingua-rakyat.my</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Bricolage", data: font, weight: 700 as const, style: "normal" as const }]
        : undefined,
    }
  )
}
