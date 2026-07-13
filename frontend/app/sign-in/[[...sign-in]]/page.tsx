"use client"

import { useState } from "react"
import Link from "next/link"
import { useSignIn } from "@clerk/nextjs"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/oauth-icons"
import { AuthShell, AuthGlobalError } from "@/components/auth-shell"

type Provider = "oauth_google" | "oauth_github"

export default function SignInPage() {
  const { signIn, errors } = useSignIn()
  const [pending, setPending] = useState<Provider | null>(null)

  const continueWith = async (strategy: Provider) => {
    setPending(strategy)
    try {
      const { error } = await signIn.sso({
        strategy,
        redirectUrl: "/workspace",
        redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      })
      if (error) {
        console.error("[SignIn] SSO error:", error)
        setPending(null)
      }
    } catch (err) {
      console.error("[SignIn] SSO threw:", err)
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
      <AuthGlobalError message={errors?.global?.[0]?.message} />

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={pending !== null}
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
          disabled={pending !== null}
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
