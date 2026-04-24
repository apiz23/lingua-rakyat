import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/components/language-provider"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Analytics } from "@vercel/analytics/next"
import CommandPaletteTopRight from "@/components/navbar"

import { Sora, JetBrains_Mono } from "next/font/google"

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "LinguaRakyat – AI for Government Documents",
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
    title: "LinguaRakyat – AI for Government Documents",
    description:
      "Ask questions about government policies and programs using AI.",
    url: "https://docuquery.vercel.app",
    siteName: "LinguaRakyat",
    locale: "en_US",
    type: "website",
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
      className={cn("antialiased", sora.variable, jetbrainsMono.variable)}
    >
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <TooltipProvider>
              <Toaster richColors expand={true} position="top-center" />
              {children}
              <CommandPaletteTopRight />
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
