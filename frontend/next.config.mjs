import createMDX from "@next/mdx"
import CopyPlugin from "copy-webpack-plugin"
import { createRequire } from "module"

// pnpm does not hoist transitive deps, so we resolve pdfjs-dist from react-pdf
const _require = createRequire(
  createRequire(import.meta.url).resolve("react-pdf/package.json")
)
const pdfWorkerSrc = _require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  allowedDevOrigins: ["http://192.168.0.108:3000", "http://192.168.1.14:3000"],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.microlink.io",
      },
      {
        protocol: "https",
        hostname: "thesvg.org",
      },
    ],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "radix-ui"],
  },

  devIndicators: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Closes clickjacking: app has authenticated single-click actions
          // (revoke share, sign out) that must never be reachable from a
          // hostile iframe overlay.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Voice input is a real feature (VoiceMicButton) — scope
          // microphone to same-origin instead of blocking it outright.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    // react-pdf / PDF.js: disable canvas (not needed for text rendering)
    config.resolve.alias.canvas = false
    // Copy PDF.js worker to public/ for production builds
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: pdfWorkerSrc,
              to: "../public/pdf.worker.min.mjs",
            },
          ],
        })
      )
    }
    return config
  },
}

const withMDX = createMDX()

export default withMDX(nextConfig)
