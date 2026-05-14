import Link from "next/link"
import { ArrowLeft, Compass, Search, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1152px] items-center px-4 py-12 sm:px-6 lg:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end">
        <section className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
            <ShieldAlert className="h-3.5 w-3.5" />
            Page Not Found
          </div>

          <p className="mb-3 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Error 404
          </p>

          <h1 className="max-w-[12ch] font-heading text-4xl leading-none font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            This route does not exist.
          </h1>

          <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
            The page may have moved, the URL may be wrong, or the route was
            removed during cleanup. Use one of the primary app surfaces below.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/workspace">
              <Button className="group w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                Open Workspace
                <Compass className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>

            <Link href="/">
              <Button
                variant="outline"
                className="group w-full gap-2 border-2 hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
              >
                Back To Home
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </section>

        <aside className="border border-border bg-card/50 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            <Search className="h-3.5 w-3.5 text-primary/70" />
            Try Instead
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="border border-border/60 bg-background/70 p-3">
              <p className="font-medium text-foreground">`/workspace`</p>
              <p className="mt-1">
                Main document assistant for uploads, featured docs, and chat.
              </p>
            </div>

            <div className="border border-border/60 bg-background/70 p-3">
              <p className="font-medium text-foreground">`/eval`</p>
              <p className="mt-1">
                Evaluation dashboards and testing flows for retrieval quality.
              </p>
            </div>

            <div className="border border-border/60 bg-background/70 p-3">
              <p className="font-medium text-foreground">`/manage`</p>
              <p className="mt-1">
                Document management surfaces if you need operational controls.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
