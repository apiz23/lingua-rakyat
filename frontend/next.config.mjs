import createMDX from "@next/mdx"

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  allowedDevOrigins: ["http://192.168.0.108:3000", "http://192.168.1.14:3000"],

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
