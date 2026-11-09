import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import {
  isLocale,
  LOCALE_COOKIE,
  pathLocale,
  stripLocale,
} from "@/lib/i18n/routing"

// No route protection — sign-in is optional everywhere. The middleware only
// lets Clerk resolve sessions for server-side rendering.
export default clerkMiddleware((_auth, request) => {
  const pathname = request.nextUrl.pathname
  if (
    /^\/(api|trpc|__clerk|_next)(\/|$)/.test(pathname) ||
    /\.[a-z0-9]+$/i.test(pathname)
  )
    return NextResponse.next()
  const prefixed = pathLocale(pathname)
  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = prefixed ?? (isLocale(saved) ? saved : "en")
  const headers = new Headers(request.headers)
  headers.set("x-lingua-locale", locale)
  headers.set("x-lingua-path", stripLocale(pathname))
  const url = request.nextUrl.clone()
  url.pathname = stripLocale(pathname)
  const response = prefixed
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } })
  response.headers.set("Content-Language", locale)
  return response
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
}
