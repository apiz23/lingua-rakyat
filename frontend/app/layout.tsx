import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/components/language-provider"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import CommandPaletteTopRight from "@/components/navbar"
import AuthSync from "@/components/auth-sync"
import OfflineProvider from "@/components/offline-provider"
import { TopoPattern } from "@/components/ui/topo-pattern"

import {
  Atkinson_Hyperlegible,
  Bricolage_Grotesque,
  JetBrains_Mono,
} from "next/font/google"

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
  display: "swap",
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://lingua-rakyat.my"),
  title: {
    template: "%s – Lingua Rakyat",
    default: "Lingua Rakyat – Government Documents, Made Plain",
  },
  description:
    "Lingua Rakyat turns Malaysian government PDFs — LHDN, KWSP, JPN and more — into plain-language answers in English, Bahasa Melayu, and Chinese. Every answer is grounded in the source document and shows its sources.",
  keywords: [
    "AI",
    "RAG",
    "government documents",
    "Malaysia",
    "public services",
    "LHDN",
    "KWSP",
    "JPN",
    "PERKESO",
    "dokumen kerajaan",
    "Lingua Rakyat",
    "LinguaRakyat",
  ],
  authors: [{ name: "Hafiz" }],
  creator: "Hafiz",
  applicationName: "Lingua Rakyat",
  openGraph: {
    title: "Lingua Rakyat – Government Documents, Made Plain",
    description:
      "Ask about Malaysian government PDFs in English, Bahasa Melayu, or Chinese. Answers are grounded in the document and cite their sources.",
    url: "https://lingua-rakyat.my",
    siteName: "Lingua Rakyat",
    countryName: "Malaysia",
    locale: "ms_MY",
    alternateLocale: ["en_US", "zh_CN"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lingua Rakyat – Government Documents, Made Plain",
    description:
      "Ask about Malaysian government PDFs in English, Bahasa Melayu, or Chinese. Grounded answers with sources cited.",
  },
  icons: {
    icon: "/icons/android-chrome-512x512.png",
    shortcut: "/icons/android-chrome-512x512.png",
    apple: "/icons/android-chrome-512x512.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        atkinson.variable,
        bricolage.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="min-h-screen overflow-x-hidden bg-background text-foreground">
        <ClerkProvider afterSignOutUrl="/workspace">
          <ThemeProvider>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-70"
            >
              <TopoPattern />
              <div className="bg-noise absolute inset-0 opacity-[0.035] dark:opacity-[0.05]" />
            </div>
            <LanguageProvider>
              <TooltipProvider>
                <Toaster richColors expand={true} position="top-center" />
                {children}
                <AuthSync />
                <OfflineProvider />
                <CommandPaletteTopRight />
              </TooltipProvider>
            </LanguageProvider>
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  )
}
