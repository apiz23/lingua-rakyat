import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/sign-in/", "/sign-up/", "/sso-callback/"],
      },
    ],
    sitemap: "https://lingua-rakyat.my/sitemap.xml",
  }
}
