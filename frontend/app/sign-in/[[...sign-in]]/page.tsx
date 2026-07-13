"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AuthShell,
  AuthFieldLabel,
  AuthFieldError,
  AuthGlobalError,
} from "@/components/auth-shell"

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()
  const [code, setCode] = useState("")

  const finalizeAndGo = async () => {
    await signIn.finalize({
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
    const identifier = formData.get("email") as string
    const password = formData.get("password") as string

    await signIn.password({ identifier, password })

    if (signIn.status === "complete") {
      await finalizeAndGo()
    }
  }

  const handleVerifyCode = async (formData: FormData) => {
    const codeValue = formData.get("code") as string
    await signIn.mfa.verifyTOTP({ code: codeValue })

    if (signIn.status === "complete") {
      await finalizeAndGo()
    }
  }

  if (signIn.status === "needs_second_factor") {
    return (
      <AuthShell
        title="Verify it's you"
        subtitle="Enter the code from your authenticator app"
      >
        <form action={handleVerifyCode} className="space-y-4">
          <div>
            <AuthFieldLabel htmlFor="code">Verification code</AuthFieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <AuthFieldError message={errors?.fields?.code?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={fetchStatus === "fetching"}>
            {fetchStatus === "fetching" && <Loader2 className="animate-spin" />}
            Verify
          </Button>
        </form>
      </AuthShell>
    )
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
      <form action={handleSubmit} className="space-y-4">
        <AuthGlobalError message={errors?.global?.[0]?.message} />

        <div>
          <AuthFieldLabel htmlFor="email">Email address</AuthFieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <AuthFieldError message={errors?.fields?.identifier?.message} />
        </div>

        <div>
          <AuthFieldLabel htmlFor="password">Password</AuthFieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <AuthFieldError message={errors?.fields?.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={fetchStatus === "fetching"}>
          {fetchStatus === "fetching" && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
