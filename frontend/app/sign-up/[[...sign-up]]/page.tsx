"use client"

import { useState } from "react"
import Link from "next/link"
import { useSignUp } from "@clerk/nextjs"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/oauth-icons"
import { AuthShell, AuthGlobalError } from "@/components/auth-shell"

type Provider = "oauth_google" | "oauth_github"

export default function SignUpPage() {
  const { signUp, errors } = useSignUp()
  const [pending, setPending] = useState<Provider | null>(null)

  const continueWith = async (strategy: Provider) => {
    setPending(strategy)
    try {
      const { error } = await signUp.sso({
        strategy,
        redirectUrl: "/workspace",
        redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      })
      if (error) {
        console.error("[SignUp] SSO error:", error)
        setPending(null)
      }
    } catch (err) {
      console.error("[SignUp] SSO threw:", err)
      setPending(null)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save your chat history and manage your shares"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
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
