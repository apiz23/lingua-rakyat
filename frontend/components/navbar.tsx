"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Globe,
  LayoutDashboard,
  FolderOpen,
  FileText,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from "lucide-react"

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
  const isMobile = useMobile()

  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

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
          results: "Pameran",
          toggleLanguage: "Tukar bahasa",
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
          results: "Showcase",
          toggleLanguage: "Toggle language",
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
        id: "results",
        label: copy.results,
        hint: "/results",
        icon: TrendingUp,
        action: () => router.push("/results"),
      },
    ],
    [
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
        id: "language",
        label: copy.toggleLanguage,
        hint: language === "ms" ? "English" : "Bahasa Melayu",
        icon: Globe,
        action: toggleLanguage,
      },
    ],
    [copy.toggleLanguage, language, toggleLanguage]
  )

  function runAction(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className="rounded-none border-2 border-foreground bg-background shadow-[6px_6px_0_0_hsl(var(--shadow-color)/0.85)]"
      >
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
