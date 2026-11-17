export const OFFLINE_PROTOCOL_VERSION = "phase0b-2"
const CHANNEL = "lingua-rakyat-isolation"
const STORAGE_KEY = "lr-isolation-invalidation:v2"
const TYPE = "LR_ISOLATION_INVALIDATE"

export async function within<T>(work: Promise<T>, timeoutMs = 4000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Verification timed out")), timeoutMs) }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

type Invalidation = { type: typeof TYPE; version: string; id: string }
const INVALIDATION_KEYS = ["type", "version", "id"]

function isInvalidation(value: unknown): value is Invalidation {
  if (typeof value !== "object" || value === null) return false
  if (Object.keys(value).some((key) => !INVALIDATION_KEYS.includes(key))) {
    return false
  }
  const id = Reflect.get(value, "id")
  return (
    Reflect.get(value, "type") === TYPE &&
    Reflect.get(value, "version") === OFFLINE_PROTOCOL_VERSION &&
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 128
  )
}

/** Worker-to-page invalidation handshake message, narrowed without a cast. */
export function isOfflineInvalidationMessage(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  return (
    Reflect.get(value, "type") === "LR_OFFLINE_INVALIDATE" &&
    Reflect.get(value, "version") === OFFLINE_PROTOCOL_VERSION
  )
}

/** Broadcasts invalidation only; it never carries an actor, token or content. */
export function createInvalidationChannel(onInvalidate: () => void) {
  let channel: BroadcastChannel | null = null
  const seen = new Set<string>()
  const receive = (value: unknown) => {
    if (!isInvalidation(value) || seen.has(value.id)) return
    if (seen.size >= 128) seen.clear()
    seen.add(value.id)
    onInvalidate()
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (event) => receive(event.data)
    }
  } catch { channel = null }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try { receive(JSON.parse(event.newValue)) } catch { /* ignore malformed events */ }
  }
  window.addEventListener("storage", onStorage)
  return {
    send() {
      const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const message: Invalidation = { type: TYPE, version: OFFLINE_PROTOCOL_VERSION, id }
      try { if (channel) { channel.postMessage(message); return true } } catch { /* try storage */ }
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message)); window.localStorage.removeItem(STORAGE_KEY); return true } catch { return false }
    },
    close() { channel?.close(); window.removeEventListener("storage", onStorage) },
  }
}

function isOfflineStatus(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  return (
    Reflect.get(value, "type") === "LR_OFFLINE_STATUS" &&
    Reflect.get(value, "version") === OFFLINE_PROTOCOL_VERSION &&
    Reflect.get(value, "clean") === true
  )
}

/** A bounded challenge to the controlling worker; an old or silent worker fails closed. */
export function confirmOfflineController(controller: ServiceWorker | null, timeoutMs = 4000): Promise<boolean> {
  if (!controller || typeof MessageChannel === "undefined") return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      channel.port1.close()
      channel.port2.close()
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    channel.port1.onmessage = (event) => {
      finish(isOfflineStatus(event.data))
    }
    try { controller.postMessage({ type: "LR_OFFLINE_CHECK" }, [channel.port2]) } catch { finish(false) }
  })
}
