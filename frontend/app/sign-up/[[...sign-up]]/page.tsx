"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSignUp } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AuthShell,
  AuthFieldLabel,
  AuthFieldError,
  AuthGlobalError,
} from "@/components/auth-shell"

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp()
  const router = useRouter()

  const finalizeAndGo = async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/workspace")
        if (url.startsWith("http")) {
          window.location.href = url
        } else {
          router.push(url)
        }
      },
    })
  }

  const handleSubmit = async (formData: FormData) => {
    const emailAddress = formData.get("email") as string
    const password = formData.get("password") as string

    const { error } = await signUp.password({ emailAddress, password })
    if (!error) await signUp.verifications.sendEmailCode()
  }

  const handleVerify = async (formData: FormData) => {
    const code = formData.get("code") as string
    await signUp.verifications.verifyEmailCode({ code })

    if (signUp.status === "complete") {
      await finalizeAndGo()
    }
  }

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="Enter the verification code we just sent you"
      >
        <form action={handleVerify} className="space-y-4">
          <AuthGlobalError message={errors?.global?.[0]?.message} />
          <div>
            <AuthFieldLabel htmlFor="code">Verification code</AuthFieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <AuthFieldError message={errors?.fields?.code?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={fetchStatus === "fetching"}>
            {fetchStatus === "fetching" && <Loader2 className="animate-spin" />}
            Verify email
          </Button>
          <button
            type="button"
            onClick={() => signUp.verifications.sendEmailCode()}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Resend code
          </button>
        </form>
      </AuthShell>
    )
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
      <form action={handleSubmit} className="space-y-4">
        <AuthGlobalError message={errors?.global?.[0]?.message} />

        <div>
          <AuthFieldLabel htmlFor="email">Email address</AuthFieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <AuthFieldError message={errors?.fields?.emailAddress?.message} />
        </div>

        <div>
          <AuthFieldLabel htmlFor="password">Password</AuthFieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <AuthFieldError message={errors?.fields?.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={fetchStatus === "fetching"}>
          {fetchStatus === "fetching" && <Loader2 className="animate-spin" />}
          Create account
        </Button>

        {/* Required for sign-up flows — Clerk's bot protection widget */}
        <div id="clerk-captcha" />
      </form>
    </AuthShell>
  )
}
