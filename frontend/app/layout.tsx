import type { Metadata } from "next"
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import Footer from "@/components/footer"
import Navbar from "@/components/navbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Fps } from "@/components/ui/fps"

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
      className={cn(
        "antialiased",
        fontSans.className,
        fontSerif.className,
        fontMono.className,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <Toaster richColors expand={true} />
            <Fps strategy="fixed" position="top-right" /> {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
