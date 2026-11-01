"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import { WifiOff } from "lucide-react"
import { purgeLegacyOfflineData } from "@/lib/offline-cache"
import { useLanguage } from "@/components/language-provider"
import { confirmOfflineController, createInvalidationChannel, OFFLINE_PROTOCOL_VERSION, within } from "@/lib/offline-protocol"

type State = "checking" | "ready" | "blocked"

/** Private descendants are unmounted until this tab has independently revalidated. */
export default function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  const clerk = useClerk()
  const { language } = useLanguage()
  const copy = {
    en: "Offline: reconnect to access documents and saved answers",
    ms: "Luar talian: sambung semula untuk mengakses dokumen dan jawapan tersimpan",
    zh: "离线：请重新连接网络以访问文件和已保存的答案",
  }
  const [state, setState] = useState<State>("checking")
  const [verifiedActor, setVerifiedActor] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [offline, setOffline] = useState(false)
  const generation = useRef(0)
  const mounted = useRef(false)
  const channel = useRef<ReturnType<typeof createInvalidationChannel> | null>(null)
  const actor = useRef<string | null>(null)
  const currentActor = !isLoaded ? null : isSignedIn ? (userId ? `signed-in:${userId}` : null) : "signed-out"

  const invalidate = useCallback(() => {
    generation.current += 1
    setState("checking")
    setEpoch((value) => value + 1)
  }, [])

  const verify = useCallback(async () => {
    const request = ++generation.current
    setState("checking")
    if (!currentActor || !purgeLegacyOfflineData().ok || !("serviceWorker" in navigator)) {
      if (mounted.current && generation.current === request) setState("blocked")
      return
    }
    try {
      const registration = await within(navigator.serviceWorker.register("/sw.js"))
      // Never wait indefinitely for an old/offline worker or an unresponsive tab.
      if (!registration.active || !(await confirmOfflineController(navigator.serviceWorker.controller))) throw new Error("Unconfirmed worker")
      // Reload the local Clerk client in each tab. No peer-supplied identity is trusted.
      await within(clerk.client.reload())
      if (isSignedIn) {
        const token = await within(getToken({ skipCache: true }))
        if (!token || !userId || clerk.session?.user?.id !== userId) throw new Error("Identity unavailable")
      } else if (clerk.session) {
        throw new Error("Identity changed")
      }
      if (mounted.current && generation.current === request) { setVerifiedActor(currentActor); setState("ready") }
    } catch {
      if (mounted.current && generation.current === request) setState("blocked")
    }
  }, [clerk, getToken, currentActor, isSignedIn, userId])

  useEffect(() => {
    mounted.current = true
    const peer = createInvalidationChannel(invalidate)
    channel.current = peer
    const onController = () => { invalidate(); peer.send() }
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "LR_OFFLINE_INVALIDATE" && event.data.version === OFFLINE_PROTOCOL_VERSION) onController()
    }
    const onConnectivity = () => { setOffline(!navigator.onLine); invalidate() }
    const onFocus = () => invalidate()
    navigator.serviceWorker?.addEventListener("controllerchange", onController)
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage)
    window.addEventListener("online", onConnectivity)
    window.addEventListener("offline", onConnectivity)
    window.addEventListener("focus", onFocus)
    setOffline(!navigator.onLine)
    return () => {
      mounted.current = false
      generation.current += 1
      channel.current = null
      peer.close()
      navigator.serviceWorker?.removeEventListener("controllerchange", onController)
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage)
      window.removeEventListener("online", onConnectivity)
      window.removeEventListener("offline", onConnectivity)
      window.removeEventListener("focus", onFocus)
    }
  }, [invalidate])

  useEffect(() => {
    if (!isLoaded) { invalidate(); return }
    const current = isSignedIn ? `signed-in:${userId ?? ""}` : "signed-out"
    if (actor.current !== null && actor.current !== current) channel.current?.send()
    actor.current = current
    invalidate()
  }, [isLoaded, isSignedIn, userId, invalidate])

  useEffect(() => {
    if (state === "checking" && isLoaded) void verify()
  }, [state, epoch, isLoaded, verify])

  if (state !== "ready" || !currentActor || verifiedActor !== currentActor) {
    return <div role="status" className="p-6"><p>Checking this device and your session. Private content is unavailable until verification succeeds.</p>{state === "blocked" && <button type="button" onClick={invalidate}>Retry</button>}</div>
  }
  return <Fragment key={epoch}>{children}{offline && <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[100] flex items-center gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning-foreground"><WifiOff className="h-3.5 w-3.5" /><span>{copy[language]}</span></div>}</Fragment>
}
