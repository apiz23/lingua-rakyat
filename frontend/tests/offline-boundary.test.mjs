import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import React, { act, useState } from "react"
import renderer from "react-test-renderer"
import ts from "typescript"

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)

function load(mocks) {
  const source = readFileSync(new URL("../components/offline-provider.tsx", import.meta.url), "utf8")
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const loaded = { exports: {} }
  new Function("require", "module", "exports", code)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    loaded,
    loaded.exports
  )
  return loaded.exports.default
}

function installGlobals({ serviceWorker, storageOk = true, cacheKeys = [] } = {}) {
  const events = new Map()
  const deleted = []
  const oldWindow = globalThis.window
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  const oldCaches = Object.getOwnPropertyDescriptor(globalThis, "caches")

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true, ...(serviceWorker ? { serviceWorker } : {}) },
  })
  globalThis.window = {
    addEventListener: (type, fn) => events.set(type, fn),
    removeEventListener: (type) => events.delete(type),
  }
  if (cacheKeys.length) {
    globalThis.caches = {
      keys: async () => cacheKeys,
      delete: async (key) => {
        deleted.push(key)
        return true
      },
    }
  } else {
    Object.defineProperty(globalThis, "caches", { configurable: true, value: undefined })
  }

  return {
    events,
    deleted,
    restore() {
      globalThis.window = oldWindow
      if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator)
      else delete globalThis.navigator
      if (oldCaches) Object.defineProperty(globalThis, "caches", oldCaches)
      else delete globalThis.caches
    },
    purgeResult: () => ({ ok: storageOk, failed: storageOk ? [] : ["history"] }),
  }
}

test("public content renders when the service worker and storage are unavailable", async () => {
  const serviceWorker = {
    register: async () => {
      throw new Error("service worker blocked")
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const globals = installGlobals({ serviceWorker, storageOk: false })
  const OfflineProvider = load({
    "@clerk/nextjs": { useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }) },
    "@/lib/offline-cache": { purgeLegacyOfflineData: globals.purgeResult },
    "@/components/language-provider": { useLanguage: () => ({ language: "en" }) },
    "@/lib/offline-protocol": {
      OFFLINE_PROTOCOL_VERSION: "phase0b-2",
      createInvalidationChannel: () => ({ send: () => true, close() {} }),
    },
    "lucide-react": { WifiOff: () => null },
  })
  let root
  try {
    await act(async () => {
      root = renderer.create(
        React.createElement(OfflineProvider, null, React.createElement("p", null, "public landing"))
      )
      await Promise.resolve()
    })
    const tree = JSON.stringify(root.toJSON())
    assert.match(tree, /public landing/)
    assert.doesNotMatch(tree, /could not be verified/)
    assert.doesNotMatch(tree, /Checking this device/)
  } finally {
    if (root) await act(async () => root.unmount())
    globals.restore()
  }
})

test("legacy worker caches are purged without waiting for a worker handshake", async () => {
  const globals = installGlobals({
    serviceWorker: {
      register: async () => ({ active: null }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    cacheKeys: ["lingua-rakyat-offline-v1", "unrelated-cache"],
  })
  const OfflineProvider = load({
    "@clerk/nextjs": { useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }) },
    "@/lib/offline-cache": { purgeLegacyOfflineData: globals.purgeResult },
    "@/components/language-provider": { useLanguage: () => ({ language: "en" }) },
    "@/lib/offline-protocol": {
      OFFLINE_PROTOCOL_VERSION: "phase0b-2",
      createInvalidationChannel: () => ({ send: () => true, close() {} }),
    },
    "lucide-react": { WifiOff: () => null },
  })
  let root
  try {
    await act(async () => {
      root = renderer.create(
        React.createElement(OfflineProvider, null, React.createElement("p", null, "public landing"))
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.deepEqual(globals.deleted, ["lingua-rakyat-offline-v1"])
  } finally {
    if (root) await act(async () => root.unmount())
    globals.restore()
  }
})

test("actor switches remount private children and broadcast invalidation", async () => {
  const globals = installGlobals({
    serviceWorker: {
      register: async () => ({ active: {} }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
  let broadcasts = 0
  let actor = { isLoaded: true, isSignedIn: true, userId: "A" }
  let mounts = 0
  function Child() {
    const [mountId] = useState(() => {
      mounts += 1
      return mounts
    })
    return React.createElement("p", null, `private-${mountId}`)
  }
  const OfflineProvider = load({
    "@clerk/nextjs": { useAuth: () => actor },
    "@/lib/offline-cache": { purgeLegacyOfflineData: globals.purgeResult },
    "@/components/language-provider": { useLanguage: () => ({ language: "en" }) },
    "@/lib/offline-protocol": {
      OFFLINE_PROTOCOL_VERSION: "phase0b-2",
      createInvalidationChannel: () => ({
        send: () => {
          broadcasts += 1
          return true
        },
        close() {},
      }),
    },
    "lucide-react": { WifiOff: () => null },
  })
  let root
  try {
    await act(async () => {
      root = renderer.create(React.createElement(OfflineProvider, null, React.createElement(Child)))
      await Promise.resolve()
    })
    assert.match(JSON.stringify(root.toJSON()), /private-1/)

    actor = { isLoaded: true, isSignedIn: true, userId: "B" }
    await act(async () => {
      root.update(React.createElement(OfflineProvider, null, React.createElement(Child)))
      await Promise.resolve()
    })
    assert.match(JSON.stringify(root.toJSON()), /private-2/)
    assert.equal(broadcasts, 1)
  } finally {
    if (root) await act(async () => root.unmount())
    globals.restore()
  }
})

test("controller change invalidates peers but never blanks the page", async () => {
  const serviceWorker = {
    register: async () => ({ active: {} }),
    addEventListener: (type, fn) => globals.events.set(type, fn),
    removeEventListener: (type) => globals.events.delete(type),
  }
  const globals = installGlobals({ serviceWorker })
  let broadcasts = 0
  const OfflineProvider = load({
    "@clerk/nextjs": { useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }) },
    "@/lib/offline-cache": { purgeLegacyOfflineData: globals.purgeResult },
    "@/components/language-provider": { useLanguage: () => ({ language: "en" }) },
    "@/lib/offline-protocol": {
      OFFLINE_PROTOCOL_VERSION: "phase0b-2",
      createInvalidationChannel: () => ({
        send: () => {
          broadcasts += 1
          return true
        },
        close() {},
      }),
    },
    "lucide-react": { WifiOff: () => null },
  })
  let root
  try {
    await act(async () => {
      root = renderer.create(
        React.createElement(OfflineProvider, null, React.createElement("p", null, "public landing"))
      )
      await Promise.resolve()
    })
    await act(async () => {
      globals.events.get("controllerchange")()
      await Promise.resolve()
    })
    assert.match(JSON.stringify(root.toJSON()), /public landing/)
    assert.equal(broadcasts, 1)
  } finally {
    if (root) await act(async () => root.unmount())
    globals.restore()
  }
})
