"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Globe,
  Moon,
  Sun,
  LayoutDashboard,
  FolderOpen,
  FileText,
  BarChart3,
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from "lucide-react"
import { useTheme } from "next-themes"

import { useLanguage } from "@/components/language-provider"
import { useMobile } from "@/hooks/use-mobile"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

type CommandEntry = {
  id: string
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  shortcut?: string
}

const OPEN_COMMAND_EVENT = "lingua-rakyat:open-command-palette"

export default function CommandPaletteTopRight() {
  const router = useRouter()
  const { language, toggleLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  const isMobile = useMobile()

  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => {
          const next = !prev
          if (next) setSearchValue("")
          return next
        })
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!open) setSearchValue("")
  }, [open])

  React.useEffect(() => {
    function onOpenCommand(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail
      setSearchValue(detail?.query ?? "")
      setOpen(true)
    }

    window.addEventListener(OPEN_COMMAND_EVENT, onOpenCommand as EventListener)
    return () =>
      window.removeEventListener(
        OPEN_COMMAND_EVENT,
        onOpenCommand as EventListener
      )
  }, [])

  const copy =
    language === "ms"
      ? {
          triggerLabel: "Cari...",
          placeholder: "Cari halaman atau tindakan...",
          noResults: "Tiada hasil dijumpai.",
          pages: "Navigasi Pantas",
          actions: "Tindakan Cepat",
          commandTitle: "Command Menu",
          home: "Utama",
          workspace: "Ruang Kerja",
          manage: "Urus Dokumen",
          eval: "Penilaian",
          benchmark: "Penanda Aras",
          results: "Pameran",
          toggleTheme: "Tukar tema",
          toggleLanguage: "Tukar bahasa",
          light: "Mod cerah",
          dark: "Mod gelap",
        }
      : {
          triggerLabel: "Search...",
          placeholder: "Search pages or actions...",
          noResults: "No results found.",
          pages: "Quick Navigation",
          actions: "Quick Actions",
          commandTitle: "Command Menu",
          home: "Home",
          workspace: "Workspace",
          manage: "Manage Documents",
          eval: "Evaluation",
          benchmark: "Benchmark",
          results: "Showcase",
          toggleTheme: "Toggle theme",
          toggleLanguage: "Toggle language",
          light: "Light mode",
          dark: "Dark mode",
        }

  const pageItems = React.useMemo<CommandEntry[]>(
    () => [
      {
        id: "home",
        label: copy.home,
        hint: "/",
        icon: LayoutDashboard,
        action: () => router.push("/"),
      },
      {
        id: "workspace",
        label: copy.workspace,
        hint: "/workspace",
        icon: FolderOpen,
        action: () => router.push("/workspace"),
      },
      {
        id: "manage",
        label: copy.manage,
        hint: "/manage",
        icon: FileText,
        action: () => router.push("/manage"),
      },
      {
        id: "eval",
        label: copy.eval,
        hint: "/eval",
        icon: BarChart3,
        action: () => router.push("/eval"),
      },
      {
        id: "benchmark",
        label: copy.benchmark,
        hint: "/benchmark",
        icon: Target,
        action: () => router.push("/benchmark"),
      },
      {
        id: "results",
        label: copy.results,
        hint: "/results",
        icon: TrendingUp,
        action: () => router.push("/results"),
      },
    ],
    [
      copy.benchmark,
      copy.eval,
      copy.home,
      copy.manage,
      copy.results,
      copy.workspace,
      router,
    ]
  )

  const actionItems = React.useMemo<CommandEntry[]>(
    () => [
      {
        id: "theme",
        label: copy.toggleTheme,
        hint: mounted && resolvedTheme === "dark" ? copy.dark : copy.light,
        icon: mounted && resolvedTheme === "dark" ? Sun : Moon,
        action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
        shortcut: "D",
      },
      {
        id: "language",
        label: copy.toggleLanguage,
        hint: language === "ms" ? "English" : "Bahasa Melayu",
        icon: Globe,
        action: toggleLanguage,
      },
    ],
    [
      copy.dark,
      copy.light,
      copy.toggleLanguage,
      copy.toggleTheme,
      language,
      mounted,
      resolvedTheme,
      setTheme,
      toggleLanguage,
    ]
  )

  function runAction(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="border-b border-border/40 bg-linear-to-r from-primary/5 via-transparent to-primary/5">
          <CommandInput
            placeholder={copy.placeholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
        </div>

        <CommandList>
          <CommandEmpty className="py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{copy.noResults}</p>
          </CommandEmpty>

          <CommandGroup heading={copy.pages}>
            {pageItems.map((item) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => runAction(item.action)}
                className="group cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 group-data-[selected=true]:bg-primary/20">
                  <item.icon className="h-4 w-4 text-muted-foreground group-data-[selected=true]:text-primary" />
                </div>

                <div className="flex flex-1 flex-col">
                  <span className="group-data-[selected=true]:text-primary">
                    {item.label}
                  </span>
                 
                </div>

                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={copy.actions}>
            {actionItems.map((item) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => runAction(item.action)}
                className="group cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 group-data-[selected=true]:bg-primary/20">
                  <item.icon className="h-4 w-4 text-muted-foreground group-data-[selected=true]:text-primary" />
                </div>

                <div className="flex flex-1 flex-col">
                  <span className="group-data-[selected=true]:text-primary">
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                </div>

                {item.shortcut && (
                  <CommandShortcut className="group-data-[selected=true]:text-primary/70">
                    <Kbd className="text-xs">{item.shortcut}</Kbd>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>

        {/* Footer with keyboard shortcuts - hide on mobile */}
        {!isMobile && (
          <div className="border-t border-border/40 px-4 py-3">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Navigate</span>
                <KbdGroup>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </KbdGroup>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Select</span>
                <Kbd>↵</Kbd>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Close</span>
                <Kbd>esc</Kbd>
              </div>
            </div>
          </div>
        )}
      </CommandDialog>
    </>
  )
}
