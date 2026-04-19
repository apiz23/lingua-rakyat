import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Safari < 14 uses addListener/removeListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
    } else {
      const legacyMql = mql as MediaQueryList & {
        addListener: (listener: () => void) => void
        removeListener: (listener: () => void) => void
      }
      legacyMql.addListener(onChange)
    }

    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange)
        return
      }
      const legacyMql = mql as MediaQueryList & {
        addListener: (listener: () => void) => void
        removeListener: (listener: () => void) => void
      }
      legacyMql.removeListener(onChange)
    }
  }, [])

  return !!isMobile
}

// Backwards-compatible alias used throughout the codebase.
export function useMobile() {
  return useIsMobile()
}
