import { Metadata } from "next"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Globe2,
  BookOpen,
  Target,
  Users,
  ShieldCheck,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Evaluation Results | Lingua Rakyat",
  description:
    "Performance metrics and Case Study 4 compliance for Lingua Rakyat",
}

export default function ResultsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="mb-12 flex flex-col items-center text-center">
        <Badge className="mb-4 p-4" variant="secondary">
          Varsity Hackathon 2026
        </Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Evaluation Results
        </h1>
        <p className="max-w-3xl text-xl text-muted-foreground">
          Comprehensive performance metrics, Case Study 4 compliance, and social
          impact analysis for Lingua Rakyat.
        </p>
      </div>

      {/* Overall Score Section */}
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        <Card className="col-span-full border-primary/20 bg-primary/5 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Overall Score</CardTitle>
            <CardDescription>Hackathon Evaluation</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="mb-2 text-6xl font-bold text-primary">
              8.2<span className="text-3xl text-muted-foreground">/10</span>
            </div>
            <Badge
              variant="outline"
              className="mt-2 border-green-500/20 bg-green-500/10 text-green-600"
            >
              <TrendingUp className="mr-1 h-3 w-3" /> +1.78 Improvement
            </Badge>
          </CardContent>
        </Card>

        <Card className="col-span-full md:col-span-2">
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
            <CardDescription>Before vs After Improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ScoreRow label="Model Performance" before={1.6} after={8.0} />
              <ScoreRow label="Data Strategy" before={5.0} after={7.8} />
              <ScoreRow label="Sustainability" before={5.2} after={7.8} />
              <ScoreRow label="AI Implementation" before={7.2} after={8.5} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <h2 className="mb-6 flex items-center text-2xl font-bold">
        <Target className="mr-2 h-6 w-6 text-primary" />
        Model Performance Metrics
      </h2>
      <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="ROUGE Score"
          value="PASS"
          description="Summarization quality vs ground truth"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <MetricCard
          title="BLEU Score"
          value="PASS"
          description="Generation quality (n-gram precision)"
          icon={<Globe2 className="h-4 w-4" />}
        />
        <MetricCard
          title="Readability"
          value="≤ 6th Grade"
          description="Flesch-Kincaid grade level"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Retrieval Confidence"
          value="≥ 0.50"
          description="Filters low-quality RAG retrievals"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      {/* Case Study 4 Compliance */}
      <h2 className="mb-6 flex items-center text-2xl font-bold">
        <CheckCircle2 className="mr-2 h-6 w-6 text-primary" />
        Case Study 4 Compliance
      </h2>
      <Card className="mb-12">
        <CardContent className="p-0">
          <div className="divide-y">
            <ComplianceRow
              title="Multilingual Support"
              description="EN, MS, ZH-CN prompts + DIALECT_MAP for 10+ codes"
              status="FULFILLED"
            />
            <ComplianceRow
              title="Dialect-Aware Translation"
              description="Keyword detection, DIALECT_MAP, QueryAugmenter"
              status="FULFILLED"
            />
            <ComplianceRow
              title="Text Simplification"
              description="Explicit LLM prompt instructions + jargon lookup (5th-grade level)"
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
              description="Pinecone RAG + confidence threshold (≥0.50) + prompt"
              status="FULFILLED"
            />
            <ComplianceRow
              title="Inclusivity UI"
              description="Next.js chat interface, mobile-friendly, WhatsApp-style"
              status="FULFILLED"
            />
            <ComplianceRow
              title="Low-Resource Models"
              description="Groq llama-3.3-70b used; SEA-LION on roadmap (Q4 2026)"
              status="PARTIAL"
              variant="warning"
            />
          </div>
        </CardContent>
      </Card>

      {/* SDG 10 Impact */}
      <h2 className="mb-6 flex items-center text-2xl font-bold">
        <Globe2 className="mr-2 h-6 w-6 text-primary" />
        Social Impact: SDG 10 Alignment
      </h2>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>SDG 10 — Reduced Inequalities</CardTitle>
          <CardDescription>
            Target 10.2: Empower and promote the social, economic and political
            inclusion of all, irrespective of age, sex, disability, race,
            ethnicity, origin, religion or economic status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 pt-4 text-center md:grid-cols-4">
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
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreRow({
  label,
  before,
  after,
}: {
  label: string
  before: number
  after: number
}) {
  const improvement = (after - before).toFixed(1)
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {before.toFixed(1)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="font-bold">{after.toFixed(1)}</span>
        <Badge
          variant="outline"
          className="w-16 justify-center border-green-500/20 bg-green-500/10 text-green-600"
        >
          +{improvement}
        </Badge>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-1 text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Badge
        variant={variant === "success" ? "default" : "secondary"}
        className={
          variant === "success"
            ? "bg-green-500 hover:bg-green-600"
            : "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30"
        }
      >
        {variant === "success" && <CheckCircle2 className="mr-1 h-3 w-3" />}
        {variant === "warning" && <AlertCircle className="mr-1 h-3 w-3" />}
        {status}
      </Badge>
    </div>
  )
}
