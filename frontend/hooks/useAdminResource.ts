"use client"

import { useCallback, useEffect, useState } from "react"
import type { DependencyList } from "react"

export function useAdminResource<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Request failed"))
    } finally {
      setLoading(false)
    }
    // loader identity is controlled by the caller's dependency list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, loading, reload: load, setData }
}
