import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "Lingua Rakyat — AI for Malaysian government documents"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Deep civic green (approx. oklch(0.38 0.13 145)) on a document-first card.
// Palette matches app/share/[slug]/opengraph-image.tsx so the two share
// surfaces read as one family.
const GREEN = "#14532d"
const PAPER = "#f5f3ec"
const MINT = "#bbf7d0"

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const data = await readFile(join(process.cwd(), "assets/bricolage-700.woff"))
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  } catch (err) {
    console.warn("[og] Bricolage font unavailable, using system sans:", err)
    return null // fall back to system sans — never fail the image
  }
}

// Quiet nod to an official-document barcode/scan strip — grounds the card
// in real government-paperwork material without risking a logo/trademark,
// and without the "broken glyph" look bordered empty boxes gave.
function BarcodeStrip() {
  const widths = [3, 2, 5, 2, 2, 4, 3, 2, 6, 2, 3, 2, 4, 2, 5, 2, 3]
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
      {widths.map((w, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: w,
            height: 28,
            backgroundColor: "rgba(187,247,208,0.35)",
          }}
        />
      ))}
    </div>
  )
}

export default async function Image() {
  const font = await loadFont()

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
          padding: "64px 80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top row: eyebrow + quiet document-barcode texture */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: MINT,
            }}
          >
            Civic AI · Malaysia
          </div>
          <BarcodeStrip />
        </div>

        {/* Middle: wordmark, subhead, trilingual signature strip */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 92,
                fontWeight: 700,
                lineHeight: 1.05,
                display: "flex",
                fontFamily: font ? "Bricolage" : "sans-serif",
              }}
            >
              Lingua Rakyat
            </div>
            <div style={{ fontSize: 34, color: PAPER, lineHeight: 1.35, display: "flex", fontWeight: 400 }}>
              Ask your government documents anything.
            </div>
          </div>

          {/* Signature: the tri-language claim, shown rather than told */}
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {["FAHAM", "UNDERSTAND", "明白"].map((word, i) => (
              <div key={word} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      width: 1,
                      height: 22,
                      backgroundColor: "rgba(245,243,236,0.3)",
                      margin: "0 20px",
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: MINT,
                  }}
                >
                  {word}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row: domain + the agencies actually in the library */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 26, color: MINT }}>lingua-rakyat.my</div>
          <div style={{ display: "flex", gap: 16 }}>
            {["JPN", "IMIGRESEN", "KWSP", "PTPTN"].map((agency) => (
              <div
                key={agency}
                style={{
                  display: "flex",
                  border: "2px solid rgba(74,222,128,0.35)",
                  borderRadius: 999,
                  padding: "8px 20px",
                  fontSize: 22,
                  color: PAPER,
                }}
              >
                {agency}
              </div>
            ))}
          </div>
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
