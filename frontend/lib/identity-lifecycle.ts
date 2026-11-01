export function resolveIdentity(isLoaded: boolean, isSignedIn: boolean | undefined, userId?: string | null) {
  if (!isLoaded || isSignedIn === undefined) return { state: "loading" as const, key: null }
  if (isSignedIn && !userId) return { state: "transitioning" as const, key: null }
  if (isSignedIn) return { state: "signed_in" as const, key: `user:${userId}` }
  return { state: "signed_out" as const, key: "signed_out" }
}

/** Per-mounted-boundary request lifetime; abort is backed by a generation check. */
export function createIdentityLifecycle() {
  let generation = 0
  let closed = false
  const controllers = new Set<AbortController>()
  return {
    snapshot() {
      const captured = generation
      return () => !closed && generation === captured
    },
    begin() {
      const captured = generation
      const controller = new AbortController()
      controllers.add(controller)
      return {
        signal: controller.signal,
        current: () => !closed && generation === captured && !controller.signal.aborted,
        finish: () => controllers.delete(controller),
      }
    },
    invalidate() {
      generation += 1
      for (const controller of controllers) controller.abort()
      controllers.clear()
    },
    close() {
      closed = true
      generation += 1
      for (const controller of controllers) controller.abort()
      controllers.clear()
    },
  }
}
