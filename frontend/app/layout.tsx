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
  Space_Grotesk,
  JetBrains_Mono,
} from "next/font/google"

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
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
    default: "Lingua Rakyat – AI for Government Documents",
  },
  description:
    "LinguaRakyat is an AI-powered system that helps citizens understand government documents using Retrieval-Augmented Generation (RAG).",
  keywords: [
    "AI",
    "RAG",
    "government documents",
    "Malaysia",
    "public services",
    "LinguaRakyat",
  ],
  authors: [{ name: "Hafiz" }],
  creator: "Hafiz",
  openGraph: {
    title: "Lingua Rakyat – AI for Government Documents",
    description:
      "Ask questions about government policies and programs using AI.",
    url: "https://lingua-rakyat.my",
    siteName: "LinguaRakyat",
    locale: "ms_MY",
    alternateLocale: ["en_US", "zh_CN"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lingua Rakyat – AI for Government Documents",
    description:
      "Ask questions about Malaysian government documents in Malay, English, or Chinese.",
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
        spaceGrotesk.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="min-h-screen bg-background text-foreground">
        <ClerkProvider afterSignOutUrl="/workspace">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-70"
            >
              <TopoPattern />
              <div className="bg-civic-glow absolute -top-[20%] right-[5%] h-[55%] w-[45%] blur-3xl" />
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
