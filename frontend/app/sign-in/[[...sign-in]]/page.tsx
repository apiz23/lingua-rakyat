"use client"

import { useState } from "react"
import Link from "next/link"
import { useSignIn } from "@clerk/nextjs/legacy"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/oauth-icons"
import { AuthShell, AuthGlobalError } from "@/components/auth-shell"

type Provider = "oauth_google" | "oauth_github"

export default function SignInPage() {
  const { isLoaded, signIn } = useSignIn()
  const [pending, setPending] = useState<Provider | null>(null)
  const [globalError, setGlobalError] = useState<string>()

  const continueWith = async (strategy: Provider) => {
    if (!isLoaded) return
    setPending(strategy)
    setGlobalError(undefined)
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/workspace",
      })
    } catch (err) {
      console.error("[SignIn] OAuth redirect threw:", err)
      setGlobalError("Couldn't start sign-in. Please try again.")
      setPending(null)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to sync your chat history and shares"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <AuthGlobalError message={globalError} />

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={!isLoaded || pending !== null}
          onClick={() => continueWith("oauth_google")}
        >
          {pending === "oauth_google" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={!isLoaded || pending !== null}
          onClick={() => continueWith("oauth_github")}
        >
          {pending === "oauth_github" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}
          Continue with GitHub
        </Button>
      </div>
    </AuthShell>
  )
}
