"use client"

import { useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

function usePersistedSetting<T>(
  key: string,
  defaultValue: T,
  parseStored: (raw: string) => T | undefined
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue)
  const loadedRef = useRef(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) {
      const parsed = parseStored(stored)
      if (parsed !== undefined) setValue(parsed)
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

/** useState persisted as a boolean. Unknown stored values keep the default. */
export function useLocalStorageBoolean(
  key: string,
  defaultValue: boolean
): [boolean, Dispatch<SetStateAction<boolean>>] {
  return usePersistedSetting(key, defaultValue, (raw) => raw === "true")
}

/** useState persisted as a string. The parser rejects unknown stored values. */
export function useLocalStorageString<T extends string>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T | undefined
): [T, Dispatch<SetStateAction<T>>] {
  return usePersistedSetting(key, defaultValue, parse)
}
