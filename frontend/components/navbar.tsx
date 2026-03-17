"use client"

import { useState } from "react"
import { FileText, ArrowRight, LogIn, Rocket, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import Image from "next/image"
import logo from "@/public/icons/android-chrome-512x512.png"
import Link from "next/link"

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="relative z-10 border-b border-border/40 bg-background/50 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-lg bg-primary/20 blur-sm" />
              <div className="relative rounded-lg bg-primary/10">
                <Image
                  src={logo}
                  alt="LinguaRakyat logo"
                  width={32}
                  height={32}
                  className="rounded-md"
                />
              </div>
            </div>

            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-xl font-bold text-transparent">
              Lingua Rakyat
            </span>
          </div>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-4 md:flex">
            <ModeToggle />

            <Link href={"workspace"}>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Try Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile Drawer */}
          <div className="md:hidden">
            <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DrawerTrigger asChild>
                <button
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </DrawerTrigger>

              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="text-left">
                  <DrawerTitle className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-1.5">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <span>LinguaRakyat</span>
                  </DrawerTitle>

                  <DrawerDescription>
                    Access LinguaRakyat AI assistant
                  </DrawerDescription>
                </DrawerHeader>

                <div className="space-y-3 px-4">
                  {/* Theme */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ModeToggle />
                  </div>

                  {/* Demo */}
                  <Button
                    className="w-full justify-start gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Rocket className="h-4 w-4" />
                    Try Demo
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </div>

                <DrawerFooter className="border-t border-border/40">
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full">
                      Close Menu
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
    </nav>
  )
}
