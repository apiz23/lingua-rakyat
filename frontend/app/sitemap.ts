import type { MetadataRoute } from "next"
import { locales, localizeHref } from '@/lib/i18n/routing'

const BASE_URL = "https://lingua-rakyat.my"

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/results`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]
  return pages.flatMap(page => locales.map(locale => {
    const pathname = page.url.slice(BASE_URL.length) || '/'
    return {...page, url:BASE_URL + localizeHref(pathname,locale), alternates:{languages:{en:BASE_URL + localizeHref(pathname,'en'),ms:BASE_URL + localizeHref(pathname,'ms')}}}
  }))
}
