import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  AlertCircle,
  Globe2,
  BookOpen,
  Target,
  Users,
  ShieldCheck,
  MessageSquare,
  FolderOpen,
  FlaskConical,
  BarChart3,
  ArrowRight,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Showcase | Lingua Rakyat",
  description:
    "A static showcase page with quality targets, feature checklist, and social impact summary for Lingua Rakyat.",
}

export default function ResultsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Lingua Rakyat
        </p>
        <h1 className="mb-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          Project Showcase
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Static snapshot for demos and judges. For actual document answers, use
          the Workspace.
        </p>
      </div>

      {/* Quick Links */}
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        <div className="border border-primary/20 bg-primary/5 p-6">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Workspace
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Ask questions about a selected PDF.
          </p>
          <Button asChild className="w-full">
            <Link href="/workspace">
              Open Workspace <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border border-border bg-card/40 p-6 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Documents
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload, list, and delete documents.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/manage">
              Manage Documents <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border border-border bg-card/40 p-6 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Evaluation
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Run the test suite and compare quality metrics.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/eval">
                Open Evaluation <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/benchmark">
                View Benchmark <BarChart3 className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Performance Metrics */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Quality Targets
      </p>
      <h2 className="mb-6 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Target className="mr-2 h-6 w-6 text-primary" />
        Quality Targets (Non-User-Specific)
      </h2>
      <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="ROUGE Score"
          value="Tracked"
          description="Summarization quality vs ground truth"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <MetricCard
          title="BLEU Score"
          value="Tracked"
          description="Generation quality (n-gram precision)"
          icon={<Globe2 className="h-4 w-4" />}
        />
        <MetricCard
          title="Readability"
          value="<= 6th Grade"
          description="Flesch-Kincaid grade level"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Retrieval Confidence"
          value=">= 0.50"
          description="Filters low-quality RAG retrievals"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* Feature Checklist */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Feature Checklist
      </p>
      <h2 className="mb-6 flex items-center font-heading text-2xl font-semibold text-foreground">
        <CheckCircle2 className="mr-2 h-6 w-6 text-primary" />
        Feature Checklist (For Demos)
      </h2>
      <div className="mb-12 border border-border bg-card/40 backdrop-blur-sm">
        <div className="divide-y divide-border">
          <ComplianceRow
            title="Multilingual Support"
            description="English, Bahasa Melayu, Simplified Chinese + dialect hints"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Dialect-Aware Translation"
            description="Keyword detection + query augmentation for cross-lingual retrieval"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Text Simplification"
            description="Plain-language prompting + jargon handling (target: ~5th grade)"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Recursive Summarisation"
            description="LLM prompt enforces 3-5 bullet-point output format"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Cross-Lingual Retrieval"
            description="embed-multilingual-v3.0 + search_query input_type"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Hallucination Control"
            description="RAG grounding + confidence threshold (>= 0.50) + prompt constraints"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Inclusivity UI"
            description="Next.js chat interface, mobile-friendly, WhatsApp-style"
            status="FULFILLED"
          />
          <ComplianceRow
            title="Low-Cost / Low-Latency Inference"
            description="Optimized model routing and streaming for fast responses"
            status="IN PROGRESS"
            variant="warning"
          />
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-border" />

      {/* SDG 10 Impact */}
      <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
        Social Impact
      </p>
      <h2 className="mb-6 flex items-center font-heading text-2xl font-semibold text-foreground">
        <Globe2 className="mr-2 h-6 w-6 text-primary" />
        Social Impact: SDG 10 Alignment
      </h2>
      <div className="border border-primary/20 bg-primary/5 p-6">
        <h3 className="mb-1 font-heading text-lg font-semibold text-foreground">
          SDG 10 — Reduced Inequalities
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Target 10.2: Empower and promote the social, economic and political
          inclusion of all, irrespective of age, sex, disability, race,
          ethnicity, origin, religion or economic status.
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <div className="mb-1 text-3xl font-bold text-primary">700M+</div>
            <div className="text-sm text-muted-foreground">
              ASEAN citizens addressable
            </div>
          </div>
          <div>
            <div className="mb-1 text-3xl font-bold text-primary">1,000+</div>
            <div className="text-sm text-muted-foreground">
              Languages spoken across ASEAN
            </div>
          </div>
          <div>
            <div className="mb-1 text-3xl font-bold text-primary">$0</div>
            <div className="text-sm text-muted-foreground">
              Cost to citizens (free access)
            </div>
          </div>
          <div>
            <div className="mb-1 text-3xl font-bold text-primary">
              5th Grade
            </div>
            <div className="text-sm text-muted-foreground">
              Reading level target
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="border border-border bg-card/40 p-5 backdrop-blur-sm">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon} {title}
      </p>
      <div className="mb-1 text-2xl font-bold text-foreground">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function ComplianceRow({
  title,
  description,
  status,
  variant = "success",
}: {
  title: string
  description: string
  status: string
  variant?: "success" | "warning"
}) {
  return (
    <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-xs font-medium",
          variant === "success"
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-border bg-muted/30 text-muted-foreground"
        )}
      >
        {variant === "success" && <CheckCircle2 className="h-3 w-3" />}
        {variant === "warning" && <AlertCircle className="h-3 w-3" />}
        {status}
      </span>
    </div>
  )
}
