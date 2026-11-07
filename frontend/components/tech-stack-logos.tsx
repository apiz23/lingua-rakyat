import { ArrowUpRight, Braces, Database, Layers, Network, Search, Zap } from "lucide-react"
const DETAILS: Record<string, { label: string; icon: typeof Braces }> = {
 "Next.js": { label: "Web application", icon: Braces },
 FastAPI: { label: "Application API", icon: Network },
 Pinecone: { label: "Vector retrieval", icon: Search },
 Cohere: { label: "Multilingual embeddings", icon: Layers },
 Groq: { label: "Answer generation", icon: Zap },
 Supabase: { label: "Data and storage", icon: Database },
}
export function TechStackLogos({ techs }: { techs: { name: string; url: string }[] }) {
 return <ul className="mt-8 grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-3">{techs.map(tech => { const detail = DETAILS[tech.name]; const Icon = detail?.icon ?? Braces; return <li key={tech.name} className="border-b border-border"><a href={tech.url} target="_blank" rel="noopener noreferrer" className="group flex h-full items-center gap-4 px-3 py-6 transition-colors hover:bg-secondary/50 sm:px-5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-6" strokeWidth={1.5} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-base font-semibold">{tech.name}</span><span className="mt-1 block text-xs text-muted-foreground">{detail?.label}</span></span><ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /><span className="sr-only">(opens in a new tab)</span></a></li> })}</ul>
}
