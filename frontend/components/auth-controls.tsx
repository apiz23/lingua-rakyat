"use client"

import Link from "next/link"
import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// Sidebar footer: sign-in for anonymous users, account menu + My shares link
// for signed-in users. Sign-in is optional — this never gates anything.
//
// Note: the installed @clerk/nextjs (v7) no longer exports <SignedIn>/
// <SignedOut> — they were replaced by the unified <Show when="signed-in" |
// "signed-out"> component. Used here in place of the brief's snippet, same
// behavior.
export function AuthControls() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="w-full">
            Sign in to sync history
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center justify-between gap-2">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link
                label="My shares"
                href="/shares"
                labelIcon={<Share2 className="h-4 w-4" />}
              />
            </UserButton.MenuItems>
          </UserButton>
          <Link
            href="/shares"
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            My shares
          </Link>
        </div>
      </Show>
    </div>
  )
}
