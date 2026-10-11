import { ImageResponse } from "next/og"

import { getShare } from "@/lib/api"
import {
  OgAside,
  OgChip,
  OgKicker,
  OgShell,
  loadBrandFonts,
  loadBrandLogo,
  ogColors,
  ogFonts,
} from "@/lib/og"
import { plainExcerpt } from "./share-text"

export const alt = "Shared answer on Lingua Rakyat — grounded in the source document, with sources cited."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 300

type ShareImageProps = { params: Promise<{ slug: string }> }

const COPY = {
  en: { kicker: "SHARED ANSWER", tag: "EN", disclaimer: "Grounded in the source document" },
  ms: { kicker: "JAWAPAN DIKONGSI", tag: "BM", disclaimer: "Berdasarkan dokumen sumber" },
  zh: { kicker: "SHARED ANSWER", tag: "ZH", disclaimer: "Berdasarkan dokumen sumber" },
} as const

function copyFor(language?: string) {
  if (language?.startsWith("zh")) return COPY.zh
  if (language?.startsWith("ms") || language?.startsWith("id")) return COPY.ms
  return COPY.en
}

// Satori renders with latin brand faces only. If the shared text contains CJK,
// fall back to latin copy instead of shipping tofu boxes into the preview card.
const CJK = /[\u3400-\u9fff]/
const hasCjk = (text: string) => CJK.test(text)
const latinOnly = (text: string | null | undefined) =>
  text && !hasCjk(text) ? text : null

export default async function OpengraphImage({ params }: ShareImageProps) {
  const [fonts, logo] = await Promise.all([loadBrandFonts(), loadBrandLogo()])
  const { slug } = await params
  const data = await getShare(slug)

  const copy = copyFor(data?.language)
  const rawQuestion = data?.question ?? ""
  const rawAnswer = data?.answer ?? ""
  const cjk = hasCjk(rawQuestion) || hasCjk(rawAnswer)

  const question = cjk
    ? "Your question, answered in plain language"
    : plainExcerpt(
        rawQuestion || "Your question about a government document",
        82
      )
  const answer = cjk
    ? "Lingua Rakyat answers from the official PDF itself and lists the sources behind the answer."
    : plainExcerpt(
        rawAnswer ||
          "A plain-language answer, grounded in the official PDF and cited to its sources.",
        130
      )
  const docName = latinOnly(data?.sources?.[0]?.doc_name?.replace(/\.pdf$/i, ""))
  const agency = latinOnly(data?.agency)
  const confidence =
    data?.confidence_label === "high"
      ? data.language?.startsWith("ms")
        ? "Padanan tinggi"
        : "High match"
      : data?.confidence_label === "low"
        ? data.language?.startsWith("ms")
          ? "Sila sahkan"
          : "Verify"
        : null

  const chips = [
    agency ? plainExcerpt(agency, 20) : null,
    docName ? plainExcerpt(docName, 24) : null,
    confidence,
  ].filter(Boolean) as string[]

  return new ImageResponse(
    (
      <OgShell aside={<OgAside tag={copy.tag} logo={logo} />}>
        <OgKicker label={copy.kicker} right="Lingua Rakyat" logo={logo} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 660,
              fontFamily: ogFonts.display,
              fontWeight: 700,
              fontSize: 52,
              lineHeight: "54px",
              letterSpacing: -1,
              color: ogColors.ink,
            }}
          >
            {question}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              maxWidth: 660,
              fontFamily: ogFonts.body,
              fontWeight: 400,
              fontSize: 26,
              lineHeight: "39px",
              color: ogColors.inkSoft,
            }}
          >
            {answer}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingTop: 20,
            borderTop: `2px solid ${ogColors.greenLine}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: ogFonts.body,
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: 4,
              color: ogColors.inkSoft,
            }}
          >
            {copy.disclaimer.toUpperCase()}
          </div>
          {chips.length > 0 ? (
            <div style={{ display: "flex", gap: 10 }}>
              {chips.map((chip) => (
                <OgChip key={chip} label={chip} />
              ))}
            </div>
          ) : null}
        </div>
      </OgShell>
    ),
    { ...size, fonts }
  )
}
