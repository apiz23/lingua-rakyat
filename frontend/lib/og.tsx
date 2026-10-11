// Shared primitives for Open Graph / Twitter preview images (satori via next/og).
// Everything here must stay self-contained: no Tailwind, no DOM, no CSS vars.

export const OG = {
  width: 1200,
  height: 630,
} as const

/** Palette mirrors app/globals.css + the app icon. Values are sRGB hex because
 *  satori/resvg does not resolve oklch(). */
export const ogColors = {
  cream: "#F6F2E7",
  paper: "#FBF9F2",
  ink: "#22352E",
  inkSoft: "#5A6A61",
  green: "#2E4A41",
  greenLine: "rgba(46, 74, 65, 0.22)",
  accent: "#3F7A5C",
  sage: "#B4C1A2",
  onGreenSoft: "rgba(245, 241, 230, 0.62)",
  onGreenFaint: "rgba(245, 241, 230, 0.10)",
} as const

export const ogFonts = {
  display: "Bricolage Grotesque, sans-serif",
  body: "Atkinson Hyperlegible, sans-serif",
} as const

type OgFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 700 | 800
  style: "normal"
}

// satori only parses .woff/.ttf (not .woff2), so every source must serve woff.
// Google first with a legacy UA (it answers .woff instead of .woff2), fontsource on jsDelivr as fallback.
const FONT_SOURCES: Array<{ name: OgFont["name"]; weight: OgFont["weight"]; urls: string[] }> = [
  {
    name: "Bricolage Grotesque",
    weight: 800,
    urls: [
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&display=swap",
      "https://cdn.jsdelivr.net/npm/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff",
    ],
  },
  {
    name: "Bricolage Grotesque",
    weight: 700,
    urls: [
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&display=swap",
      "https://cdn.jsdelivr.net/npm/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff",
    ],
  },
  {
    name: "Atkinson Hyperlegible",
    weight: 400,
    urls: [
      "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400&display=swap",
      "https://cdn.jsdelivr.net/npm/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff",
    ],
  },
  {
    name: "Atkinson Hyperlegible",
    weight: 700,
    urls: [
      "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@700&display=swap",
      "https://cdn.jsdelivr.net/npm/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff",
    ],
  },
]

// Legacy UA: modern UAs get .woff2 from Google Fonts, which satori cannot parse.
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1; rv:6.0) Gecko/20110814 Firefox/6.0"

async function fetchBuffer(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      let target = url
      if (url.includes("fonts.googleapis.com")) {
        const css = await fetch(url, { headers: { "User-Agent": LEGACY_UA } }).then((r) =>
          r.ok ? r.text() : Promise.reject(new Error(`css ${r.status}`))
        )
        const match = css.match(/src:\s*url\((https:[^)]+\.woff)\)/) ?? css.match(/url\((https:[^)]+\.woff)\)/)
        if (!match) continue
        target = match[1]
      }
      const res = await fetch(target)
      if (!res.ok) continue
      return await res.arrayBuffer()
    } catch {
      // try the next source
    }
  }
  return null
}

let fontCache: Promise<OgFont[]> | null = null

/** Fetch + cache the brand faces for satori. Throws if no source is reachable so
 *  a broken preview fails loudly instead of silently rendering in a fallback face. */
export function loadBrandFonts(): Promise<OgFont[]> {
  fontCache ??= (async () => {
    const fonts: OgFont[] = []
    for (const source of FONT_SOURCES) {
      const data = await fetchBuffer(source.urls)
      if (!data) {
        throw new Error(`[og] font unavailable: ${source.name} ${source.weight}`)
      }
      fonts.push({ name: source.name, data, weight: source.weight, style: "normal" })
    }
    return fonts
  })()
  return fontCache
}

/** The real app icon from the deployed site, inlined as a data URI so satori can
 *  draw it without remote image support. Returns null when unreachable so callers
 *  can fall back to the path-drawn mark. */
const LOGO_URL = "https://lingua-rakyat.my/icons/android-chrome-512x512.png"

let logoCache: Promise<string | null> | null = null

export function loadBrandLogo(): Promise<string | null> {
  logoCache ??= (async () => {
    try {
      const res = await fetch(LOGO_URL)
      if (!res.ok) return null
      const type = res.headers.get("content-type") ?? ""
      if (!type.includes("image")) return null
      const bytes = Buffer.from(await res.arrayBuffer())
      return `data:image/png;base64,${bytes.toString("base64")}`
    } catch {
      return null
    }
  })()
  return logoCache
}

/** Recreation of the app mark (open document / wings inside a speech bubble),
 *  drawn as paths so it survives satori without network image fetches. */
export function BrandMark({ size = 196 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <rect x="56" y="46" width="400" height="378" rx="112" fill={ogColors.green} />
      <path d="M224 424 L256 478 L288 424 Z" fill={ogColors.green} />
      {/* sage under-wings */}
      <path
        d="M122 186 C 166 202 210 244 240 300 L 240 388 C 196 350 152 280 122 186 Z"
        fill={ogColors.sage}
      />
      <path
        d="M390 186 C 346 202 302 244 272 300 L 272 388 C 316 350 360 280 390 186 Z"
        fill={ogColors.sage}
      />
      {/* cream wings / open pages */}
      <path
        d="M122 128 C 166 144 212 190 242 252 L 242 346 C 196 306 152 230 122 128 Z"
        fill={ogColors.paper}
      />
      <path
        d="M390 128 C 346 144 300 190 270 252 L 270 346 C 316 306 360 230 390 128 Z"
        fill={ogColors.paper}
      />
    </svg>
  )
}

/** Concentric contour rings — the topo motif from the app background, restated
 *  for the dark side panel. */
export function TopoContour({ width, height }: { width: number; height: number }) {
  const rings = [70, 130, 190, 250, 310, 370, 430]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {rings.map((r) => (
        <circle
          key={r}
          cx={width / 2}
          cy={height / 2}
          r={r}
          fill="none"
          stroke={ogColors.paper}
          strokeOpacity={0.07}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}

/** Squared-off chip used for agencies, languages, and confidence labels. */
export function OgChip({
  label,
  tone = "outline",
}: {
  label: string
  tone?: "outline" | "onGreen" | "solid"
}) {
  const onGreen = tone === "onGreen"
  const solid = tone === "solid"
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 18px",
        borderRadius: 6,
        borderWidth: solid ? 0 : "1.5px",
        borderStyle: "solid",
        borderColor: onGreen ? ogColors.onGreenSoft : ogColors.greenLine,
        background: solid ? ogColors.accent : "transparent",
        color: solid ? ogColors.paper : onGreen ? ogColors.paper : ogColors.green,
        fontFamily: ogFonts.body,
        fontWeight: 700,
        fontSize: 21,
        letterSpacing: 1.2,
      }}
    >
      {label}
    </div>
  )
}

/** Left/right shell shared by every preview card: editorial cream column plus
 *  full-bleed green panel carrying the mark. */
export function OgShell({
  children,
  aside,
}: {
  children: React.ReactNode
  aside: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
        background: ogColors.cream,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 52px 48px 68px",
        }}
      >
        {children}
      </div>
      <div
        style={{
          display: "flex",
          width: 348,
          position: "relative",
          overflow: "hidden",
          background: ogColors.green,
        }}
      >
        {aside}
      </div>
    </div>
  )
}

/** Standard right panel: contour rings, mark, wordmark, language tag.
 *  Pass the inlined logo from `loadBrandLogo()` to use the real app icon;
 *  otherwise the path-drawn recreation is used. */
export function OgAside({ tag, logo }: { tag: string; logo?: string | null }) {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
        <TopoContour width={348} height={630} />
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          position: "relative",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: 22,
            borderRadius: 46,
            background: ogColors.cream,
          }}
        >
          {logo ? (
            <img width={150} height={150} src={logo} alt="" style={{ objectFit: "contain" }} />
          ) : (
            <BrandMark size={150} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontFamily: ogFonts.body,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 6,
            color: ogColors.paper,
          }}
        >
          LINGUA RAKYAT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontFamily: ogFonts.body,
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: 3,
            color: ogColors.sage,
          }}
        >
          {tag}
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 40,
            fontFamily: ogFonts.body,
            fontSize: 17,
            letterSpacing: 3,
            color: ogColors.onGreenSoft,
          }}
        >
          LINGUA-RAKYAT.MY
        </div>
      </div>
    </>
  )
}

/** Kicker line: brand mark (or green square bullet) + tracked small caps. */
export function OgKicker({
  label,
  right,
  logo,
}: {
  label: string
  right?: string
  logo?: string | null
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {logo ? (
        <img width={46} height={46} src={logo} alt="" style={{ borderRadius: 10 }} />
      ) : (
        <div style={{ display: "flex", width: 14, height: 14, background: ogColors.accent }} />
      )}
      <div
        style={{
          display: "flex",
          fontFamily: ogFonts.body,
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: 7,
          color: ogColors.green,
        }}
      >
        {label}
      </div>
      {right ? (
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            fontFamily: ogFonts.body,
            fontWeight: 400,
            fontSize: 19,
            letterSpacing: 2,
            color: ogColors.inkSoft,
          }}
        >
          {right}
        </div>
      ) : null}
    </div>
  )
}
