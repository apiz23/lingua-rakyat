"use client"

import { useTranslations } from "@/components/i18n"
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useAuth } from "@clerk/nextjs"
import { WifiOff } from "lucide-react"
import { purgeLegacyOfflineData } from "@/lib/offline-cache"
import { useLanguage } from "@/components/language-provider"
import {
  createInvalidationChannel,
  OFFLINE_PROTOCOL_VERSION,
} from "@/lib/offline-protocol"

const LEGACY_CACHE_PREFIX = "lingua-rakyat"

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function getOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine
}

/**
 * Removes every cache the legacy offline worker could have written.
 *
 * This runs without a service worker on purpose: the previous worker answered
 * cached navigations, so relying on the worker to clean itself up would leave
 * stale pages visible on devices whose worker never updated. Cache Storage is
 * best-effort — browsers without it simply have nothing to purge.
 */
async function purgeLegacyCaches() {
  if (typeof caches === "undefined") return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX))
        .map((key) => caches.delete(key))
    )
  } catch {
    // A failed cache purge must never block rendering. Legacy content is also
    // unreachable because every cache reader was removed in Phase 0B.
  }
}

/**
 * Cross-tab identity/offline boundary.
 *
 * Earlier revisions rendered a full-page "checking this device" gate and
 * refused to mount children until a service worker handshake, a Clerk client
 * reload and a token fetch all succeeded. That made every public route depend
 * on service-worker support and a fast network, so privacy-restricted
 * browsers, slow registrations and stale workers saw a permanently blocked
 * site. Rendering is now unconditional: the boundary only removes legacy
 * caches and remounts the tree when the actor changes or another tab signals
 * invalidation. Private data still fails closed at the API, which verifies the
 * Clerk token server-side.
 */
export default function OfflineProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()

  const { isLoaded, isSignedIn, userId } = useAuth()
  const { language } = useLanguage()
  const online = useSyncExternalStore(subscribeOnline, getOnline, () => true)
  const offline = !online
  const [epoch, setEpoch] = useState(0)
  const mounted = useRef(false)
  const channel = useRef<ReturnType<typeof createInvalidationChannel> | null>(
    null
  )
  const actor = useRef<string | null>(null)

  const invalidate = useCallback(() => {
    void purgeLegacyCaches()
    if (mounted.current) setEpoch((value) => value + 1)
  }, [])

  useEffect(() => {
    mounted.current = true
    purgeLegacyOfflineData()
    void purgeLegacyCaches()

    const peer = createInvalidationChannel(invalidate)
    channel.current = peer

    const onController = () => {
      invalidate()
      peer.send()
    }
    const onWorkerMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "LR_OFFLINE_INVALIDATE" &&
        event.data.version === OFFLINE_PROTOCOL_VERSION
      ) {
        onController()
      }
    }
    const onConnectivity = () => {
      void purgeLegacyCaches()
    }

    navigator.serviceWorker?.addEventListener("controllerchange", onController)
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage)
    window.addEventListener("online", onConnectivity)
    window.addEventListener("offline", onConnectivity)

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The worker is an optional cache-hygiene layer, not a render gate.
      })
    }

    return () => {
      mounted.current = false
      channel.current = null
      peer.close()
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        onController
      )
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage)
      window.removeEventListener("online", onConnectivity)
      window.removeEventListener("offline", onConnectivity)
    }
  }, [invalidate])

  const actorKey = !isLoaded
    ? "pending"
    : isSignedIn
      ? `signed-in:${userId ?? ""}`
      : "signed-out"

  useEffect(() => {
    if (!isLoaded) return
    // A real actor switch must notify peer tabs. Remounting is handled by the
    // actor key below, so this effect performs no state updates.
    if (actor.current !== null && actor.current !== actorKey) {
      channel.current?.send()
    }
    actor.current = actorKey
  }, [isLoaded, actorKey])

  return (
    <Fragment key={`${actorKey}:${epoch}`}>
      {children}
      {offline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-4 z-[100] flex items-center gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning-foreground"
        >
          <WifiOff className="h-3.5 w-3.5" />
          <span>
            {language === "ms"
              ? t(
                  "Luar talian: sambung semula untuk mengakses dokumen dan jawapan tersimpan"
                )
              : language === "zh"
                ? "离线：请重新连接网络以访问文件和已保存的答案"
                : t("Offline: reconnect to access documents and saved answers")}
          </span>
        </div>
      )}
    </Fragment>
  )
}
