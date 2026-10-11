import { ImageResponse } from "next/og"

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

export const alt = "Lingua Rakyat — government documents, made plain. Answers in English, Bahasa Melayu and Chinese, grounded in the official PDF."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 3600

export default async function OpengraphImage() {
  const [fonts, logo] = await Promise.all([loadBrandFonts(), loadBrandLogo()])

  return new ImageResponse(
    (
      <OgShell aside={<OgAside tag="EN · BM · ZH" />}>
        <OgKicker label="LINGUA RAKYAT" right="Malaysia · GovTech" logo={logo} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          {["Government", "documents,"].map((line) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontFamily: ogFonts.display,
                fontWeight: 800,
                fontSize: 76,
                lineHeight: "76px",
                letterSpacing: -1.5,
                color: ogColors.ink,
              }}
            >
              {line}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              fontFamily: ogFonts.display,
              fontWeight: 800,
              fontSize: 76,
              lineHeight: "76px",
              letterSpacing: -1.5,
              color: ogColors.accent,
            }}
          >
            made plain.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              maxWidth: 640,
              fontFamily: ogFonts.body,
              fontWeight: 400,
              fontSize: 27,
              lineHeight: "38px",
              color: ogColors.inkSoft,
            }}
          >
            Ask in English, Bahasa Melayu, or Chinese — grounded in the official
            PDF, with the sources cited.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingTop: 22,
            borderTop: `2px solid ${ogColors.greenLine}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: ogFonts.body,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 4,
              color: ogColors.inkSoft,
            }}
          >
            BUILT FOR OFFICIAL MALAYSIAN DOCUMENTS
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <OgChip label="LHDN" />
            <OgChip label="KWSP" />
            <OgChip label="JPN" />
            <OgChip label="PERKESO" />
            <OgChip label="KKM" />
          </div>
        </div>
      </OgShell>
    ),
    { ...size, fonts }
  )
}
