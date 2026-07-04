"use client"

import { useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

/**
 * useState persisted to localStorage. SSR-safe: renders the default first,
 * loads the stored value in an effect (no hydration mismatch), and only
 * starts writing back after the initial load.
 */
export function useLocalStorageSetting<T extends string | boolean>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue)
  const loadedRef = useRef(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) {
      setValue(
        (typeof defaultValue === "boolean" ? stored === "true" : stored) as T
      )
    }
    loadedRef.current = true
    // defaultValue only determines the parse mode (boolean vs string)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!loadedRef.current) return
    window.localStorage.setItem(key, String(value))
  }, [key, value])

  return [value, setValue]
}
