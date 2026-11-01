import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import React, { act } from "react"
import renderer from "react-test-renderer"
import ts from "typescript"
import { within } from "../lib/offline-protocol.ts"

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
function load(mocks) {
  const source = readFileSync(new URL("../components/offline-provider.tsx", import.meta.url), "utf8")
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  new Function("require", "module", "exports", code)((name) => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports.default
}

test("mounted boundary hides content on failures and revalidates after controller change", async () => {
  const oldWindow = globalThis.window
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  const events = new Map()
  let failRegistration = true
  let clean = true
  let clerkReloads = 0
  let broadcasts = 0
  let peerInvalidation
  let resolveReload
  let holdReload = false
  let userId = "A"
  const serviceWorker = {
    controller: {},
    register: async () => { if (failRegistration) throw new Error("offline"); return { active: {} } },
    addEventListener: (type, fn) => events.set(type, fn),
    removeEventListener: (type) => events.delete(type),
  }
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker, onLine: true } })
  globalThis.window = { addEventListener: (type, fn) => events.set(type, fn), removeEventListener: (type) => events.delete(type) }
  const getToken = async () => "token"
  const clerk = { client: { reload: async () => { clerkReloads += 1; if (holdReload) await new Promise((resolve) => { resolveReload = resolve }) } }, session: { user: { id: "A" } } }
  const OfflineProvider = load({
    "@clerk/nextjs": { useAuth: () => ({ isLoaded: true, isSignedIn: true, userId, getToken }), useClerk: () => clerk },
    "@/lib/offline-cache": { purgeLegacyOfflineData: () => ({ ok: clean, failed: clean ? [] : ["history"] }) },
    "@/components/language-provider": { useLanguage: () => ({ language: "en" }) },
    "@/lib/offline-protocol": { within, OFFLINE_PROTOCOL_VERSION: "phase0b-2", confirmOfflineController: async () => true,
      createInvalidationChannel: (fn) => { peerInvalidation = fn; return { send: () => { broadcasts += 1; return true }, close() {} } } },
    "lucide-react": { WifiOff: () => null },
  })
  let root
  try {
    await act(async () => { root = renderer.create(React.createElement(OfflineProvider, null, React.createElement("p", null, "private"))); await Promise.resolve() })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /"private"/)
    assert.ok(root.root.findAllByType("button").length)
    failRegistration = false
    await act(async () => { root.root.findByType("button").props.onClick(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    assert.match(JSON.stringify(root.toJSON()), /private/)
    userId = "B"
    clerk.session.user.id = "B"
    holdReload = true
    await act(async () => { root.update(React.createElement(OfflineProvider, null, React.createElement("p", null, "private"))); await Promise.resolve() })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /"private"/)
    holdReload = false
    await act(async () => { resolveReload(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    assert.match(JSON.stringify(root.toJSON()), /private/)
    holdReload = true
    const priorBroadcasts = broadcasts
    await act(async () => { events.get("controllerchange")(); await Promise.resolve() })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /"private"/)
    assert.equal(broadcasts, priorBroadcasts + 1)
    holdReload = false
    await act(async () => { resolveReload(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    assert.match(JSON.stringify(root.toJSON()), /private/)
    assert.ok(clerkReloads >= 2)
    clean = false
    await act(async () => { peerInvalidation(); await Promise.resolve() })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /"private"/)
    clean = true
    await act(async () => { root.root.findByType("button").props.onClick(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    assert.match(JSON.stringify(root.toJSON()), /private/)
  } finally {
    if (root) await act(async () => { root.unmount() })
    globalThis.window = oldWindow
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator)
    else delete globalThis.navigator
  }
})
