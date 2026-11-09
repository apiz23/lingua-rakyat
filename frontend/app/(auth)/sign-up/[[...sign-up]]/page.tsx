"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useLanguage } from "@/components/language-provider"
import { authReturnPath, localizeHref } from "@/lib/i18n/routing"
import { useState } from "react"
import { LocalizedLink as Link } from "@/components/i18n"
import { useSignUp } from "@clerk/nextjs/legacy"
import { Github, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/oauth-icons"
import { AuthShell, AuthGlobalError } from "@/components/auth-shell"

type Provider = "oauth_google" | "oauth_github"

export default function SignUpPage() {
  const t = useTranslations()
  const { language } = useLanguage()
  const locale = language === "ms" ? "ms" : "en"

  const { isLoaded, signUp } = useSignUp()
  const [pending, setPending] = useState<Provider | null>(null)
  const [globalError, setGlobalError] = useState<string>()

  const continueWith = async (strategy: Provider) => {
    if (!isLoaded) return
    setPending(strategy)
    setGlobalError(undefined)
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: localizeHref("/sso-callback", locale),
        redirectUrlComplete: authReturnPath(
          new URLSearchParams(window.location.search).get("redirect_url"),
          locale
        ),
      })
    } catch (err) {
      console.error("[SignUp] OAuth redirect threw:", err)
      setGlobalError(t("Couldn't start sign-up. Please try again."))
      setPending(null)
    }
  }

  return (
    <AuthShell
      eyebrow={t("Create account")}
      title={t("Create your account")}
      subtitle={t("Save your chat history and manage your shares")}
      footer={
        <>
          {" "}
          <UiText text="Already have an account?" />{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline"
          >
            {" "}
            <UiText text="Sign in" />{" "}
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
          )}{" "}
          <UiText text="Continue with Google" />{" "}
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
          )}{" "}
          <UiText text="Continue with GitHub" />{" "}
        </Button>
      </div>
    </AuthShell>
  )
}
