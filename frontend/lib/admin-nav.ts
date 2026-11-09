export const ADMIN_NAV = [
  { href: "/manage", label: "Overview", icon: "gauge" },
  { href: "/manage/documents", label: "Documents", icon: "file" },
  { href: "/manage/ingestion", label: "Ingestion", icon: "upload" },
  { href: "/manage/sources", label: "Official Sources", icon: "book" },
  { href: "/manage/review", label: "Review Queue", icon: "clipboard" },
  { href: "/manage/publications", label: "Publications", icon: "clock" },
  { href: "/manage/audit", label: "Audit Logs", icon: "scroll" },
  { href: "/manage/users", label: "Users & Roles", icon: "users" },
  { href: "/manage/status", label: "System Status", icon: "activity" },
] as const

export type AdminNavItem = (typeof ADMIN_NAV)[number]
