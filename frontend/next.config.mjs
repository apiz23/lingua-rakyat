import createMDX from "@next/mdx"

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  allowedDevOrigins: ["192.168.0.108"],

  images: {
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
}

const withMDX = createMDX()

export default withMDX(nextConfig)
