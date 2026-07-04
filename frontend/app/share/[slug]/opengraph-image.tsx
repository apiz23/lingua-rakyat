import { ImageResponse } from "next/og"
import { getShare } from "@/lib/api"

export const alt = "Shared answer from Lingua Rakyat"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Per-slug OG card: the shared question on the civic-green brand background,
// so WhatsApp/Telegram link previews show what the answer is about.
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getShare(slug)
  const question = data
    ? data.question.length > 140
      ? `${data.question.slice(0, 139)}…`
      : data.question
    : "Shared answer"

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
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#bbf7d0",
            display: "flex",
          }}
        >
          Shared answer
        </div>

        <div
          style={{
            fontSize: question.length > 80 ? 48 : 60,
            fontWeight: 700,
            lineHeight: 1.2,
            display: "flex",
          }}
        >
          {question}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
            color: "#bbf7d0",
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 700, color: "#ffffff", display: "flex" }}>
            Lingua Rakyat
          </div>
          <div style={{ display: "flex" }}>lingua-rakyat.my</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
