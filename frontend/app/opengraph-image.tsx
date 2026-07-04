import { ImageResponse } from "next/og"

export const alt = "Lingua Rakyat — AI for Malaysian government documents"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Deep civic green (approx. oklch(0.38 0.13 145)) on a document-first card.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#14532d",
          padding: "72px 80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#bbf7d0",
          }}
        >
          Civic AI · Malaysia
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05 }}>
            Lingua Rakyat
          </div>
          <div style={{ fontSize: 36, color: "#dcfce7", lineHeight: 1.35 }}>
            Understand government documents. Ask in Malay, English, or 中文.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#bbf7d0",
          }}
        >
          <div style={{ display: "flex" }}>lingua-rakyat.my</div>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={badge}>LHDN</div>
            <div style={badge}>KWSP</div>
            <div style={badge}>JPN</div>
            <div style={badge}>IMIGRESEN</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}

const badge = {
  display: "flex",
  border: "2px solid #4ade8055",
  borderRadius: 999,
  padding: "8px 22px",
  color: "#dcfce7",
}
