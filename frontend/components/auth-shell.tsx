import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AuthShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          Lingua Rakyat
        </Link>

        <Card className="border border-border shadow-sm">
          <CardHeader className="gap-1 text-center">
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent className="pt-2">{children}</CardContent>
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
    <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  )
}
