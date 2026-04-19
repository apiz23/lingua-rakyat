import { Github, Linkedin, Twitter } from "lucide-react"
import Link from "next/link"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/40 bg-background/50 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 Lingua Rakyat. Multilingual AI for Public Services
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/apiz23/lingua-rakyat"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <GithubIcon size={20} />
            </Link>
            <Link
              href="https://www.linkedin.com/in/muh-hafizuddin/"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <LinkedinIcon size={20} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
