"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useLanguage } from "@/components/language-provider"
import { authReturnPath, localizeHref } from "@/lib/i18n/routing"
import { useState } from "react"
import { useSignIn } from "@clerk/nextjs/legacy"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/oauth-icons"
import { AuthShell, AuthGlobalError } from "@/components/auth-shell"

type Provider = "oauth_google" | "oauth_github"

export default function SignInPage() {
  const t = useTranslations()
  const { language } = useLanguage()
  const locale = language === "ms" ? "ms" : "en"

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
        redirectUrl: localizeHref("/sso-callback", locale),
        redirectUrlComplete: authReturnPath(
          new URLSearchParams(window.location.search).get("redirect_url"),
          locale
        ),
      })
    } catch (err) {
      console.error("[SignIn] OAuth redirect threw:", err)
      setGlobalError(t("Couldn't start sign-in. Please try again."))
      setPending(null)
    }
  }

  return (
    <AuthShell
      eyebrow={t("Sign in")}
      title={t("Continue to your workspace")}
      subtitle={t("Sync your chat history and shared answers across devices.")}
    >
      <AuthGlobalError message={globalError} />

      <div className="space-y-2.5">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2.5 text-[0.925rem] hover:border-primary/40"
          disabled={!isLoaded || pending !== null}
          onClick={() => continueWith("oauth_google")}
        >
          {pending === "oauth_google" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}{" "}
          <UiText text="Continue with Google" />{" "}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2.5 text-[0.925rem] hover:border-primary/40"
          disabled={!isLoaded || pending !== null}
          onClick={() => continueWith("oauth_github")}
        >
          {pending === "oauth_github" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}{" "}
          <UiText text="Continue with GitHub" />{" "}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {" "}
        <UiText text="Signing in creates your account automatically — no separate sign-up." />{" "}
      </p>
    </AuthShell>
  )
}
