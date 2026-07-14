import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AuthShellProps {
  eyebrow?: string
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({
  eyebrow = "Sign in",
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          <Image
            src="/icons/android-chrome-512x512.png"
            alt="Lingua Rakyat logo"
            width={32}
            height={32}
            className="rounded-full"
            unoptimized
          />
          Lingua Rakyat
        </Link>

        <Card className="border border-border shadow-sm">
          <CardHeader className="gap-1.5 pb-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {eyebrow}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent className="pt-3 pb-6">{children}</CardContent>
        </Card>

        {footer && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        )}

        <Link
          href="/workspace"
          className={cn(
            "mt-4 block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          )}
        >
          Continue without signing in
        </Link>
      </div>
    </div>
  )
}

export function AuthGlobalError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  )
}
