import createMDX from "@next/mdx"

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: {
    domains: [
      "api.microlink.io",
    ],
     remotePatterns: [
      {
        protocol: "https",
        hostname: "thesvg.org",
      },
    ],
  },
}

const withMDX = createMDX()

export default withMDX(nextConfig)
