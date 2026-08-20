"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

export default function OfflineProvider() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed right-4 bottom-4 z-[100] flex items-center gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning-foreground shadow-lg backdrop-blur dark:text-warning">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline mode: using cached documents and excerpts</span>
    </div>
  )
}
