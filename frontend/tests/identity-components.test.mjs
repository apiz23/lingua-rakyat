import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import React, { act, useEffect, useState } from "react"
import renderer from "react-test-renderer"
import ts from "typescript"
import { createIdentityLifecycle, resolveIdentity } from "../lib/identity-lifecycle.ts"

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const loadedModule = { exports: {} }
  const localRequire = (name) => name in mocks ? mocks[name] : require(name)
  new Function("require", "module", "exports", code)(localRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

let clerk = { isLoaded: true, isSignedIn: true, user: { id: "A" } }
const context = load("../components/workspace-session-context.tsx", {
  "@clerk/nextjs": { useUser: () => clerk },
  "@/lib/identity-lifecycle": { createIdentityLifecycle, resolveIdentity },
})

test("mounted workspace resets private state for signout, direct actor and session switches", async () => {
  const storage = new Map()
  globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }
  let session
  const pending = []
  function PrivateChild() {
    const value = context.useWorkspaceSession()
    session = value
    return React.createElement(SessionChild, { key: `${value.actorGeneration}:${value.sessionGeneration}`, value })
  }
  function SessionChild({ value }) {
    const [text, setText] = useState(`private-${value.userId}`)
    useEffect(() => {
      let active = true
      pending.push(() => { if (active) setText(`late-${value.userId}`) })
      return () => { active = false }
    }, [value.userId])
    return React.createElement("span", null, text)
  }
  const tree = () => React.createElement(context.WorkspaceSessionProvider, null, React.createElement(PrivateChild))
  let root
  try {
    await act(async () => { root = renderer.create(tree()) })
    assert.equal(root.toJSON().children[0], "private-A")
    const lateA = pending.at(-1)
    clerk = { isLoaded: false, isSignedIn: undefined, user: null }
    await act(async () => { root.update(tree()) })
    assert.equal(root.toJSON(), null)
    clerk = { isLoaded: true, isSignedIn: false, user: null }
    await act(async () => { root.update(tree()) })
    assert.notEqual(root.toJSON().children[0], "private-A")
    clerk = { isLoaded: true, isSignedIn: true, user: { id: "B" } }
    await act(async () => { root.update(tree()); lateA() })
    assert.equal(root.toJSON().children[0], "private-B")
    const lateB = pending.at(-1)
    await act(async () => { session.setActiveSessionId("new-session") })
    await act(async () => { lateB() })
    assert.equal(root.toJSON().children[0], "private-B")
    clerk = { isLoaded: true, isSignedIn: true, user: { id: "A" } }
    await act(async () => { root.update(tree()) })
    assert.equal(root.toJSON().children[0], "private-A")
    clerk = { isLoaded: true, isSignedIn: true, user: { id: "B" } }
    await act(async () => { root.update(tree()) })
    assert.equal(root.toJSON().children[0], "private-B")
  } finally {
    if (root) await act(async () => { root.unmount() })
    delete globalThis.localStorage
  }
})

test("mounted voice control stops late microphone permission after unmount", async () => {
  let resolvePermission
  let stopped = 0
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    mediaDevices: { getUserMedia: () => new Promise((resolve) => { resolvePermission = resolve }) },
  } })
  const hook = load("../hooks/useVoiceRecorder.ts", {
    "@/lib/config": { API_URL: "http://localhost:8000" },
  })
  const icon = () => React.createElement("i")
  const voice = load("../components/chat-panel/voice-mic-button.tsx", {
    "@/hooks/useVoiceRecorder": hook,
    "@/lib/utils": { cn: (...items) => items.filter(Boolean).join(" ") },
    "lucide-react": { Check: icon, Loader2: icon, Mic: icon },
  })
  let root
  let transcripts = 0
  try {
    await act(async () => { root = renderer.create(React.createElement(voice.VoiceMicButton, { onTranscript: () => { transcripts += 1 } })) })
    await act(async () => { root.root.findByType("button").props.onClick() })
    await act(async () => { root.unmount() })
    await act(async () => { resolvePermission({ getTracks: () => [{ stop: () => { stopped += 1 } }] }); await Promise.resolve() })
    assert.equal(stopped, 1)
    assert.equal(transcripts, 0)
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator)
    else delete globalThis.navigator
  }
})

test("mounted voice control aborts transcription and ignores a late response", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  const originalRecorder = globalThis.MediaRecorder
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let now = 1000
  let resolveFetch
  let signal
  let stopped = 0
  let transcripts = 0
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => { stopped += 1 } }] }) },
  } })
  globalThis.MediaRecorder = class {
    static isTypeSupported() { return true }
    state = "inactive"
    start() { this.state = "recording" }
    stop() { this.state = "inactive"; this.onstop?.() }
  }
  Date.now = () => now
  globalThis.fetch = (_url, init) => { signal = init.signal; return new Promise((resolve) => { resolveFetch = resolve }) }
  const hook = load("../hooks/useVoiceRecorder.ts", {
    "@/lib/config": { API_URL: "http://localhost:8000" },
  })
  const icon = () => React.createElement("i")
  const voice = load("../components/chat-panel/voice-mic-button.tsx", {
    "@/hooks/useVoiceRecorder": hook,
    "@/lib/utils": { cn: (...items) => items.filter(Boolean).join(" ") },
    "lucide-react": { Check: icon, Loader2: icon, Mic: icon },
  })
  let root
  try {
    await act(async () => { root = renderer.create(React.createElement(voice.VoiceMicButton, { onTranscript: () => { transcripts += 1 } })) })
    await act(async () => { root.root.findByType("button").props.onClick(); await Promise.resolve() })
    now = 2000
    await act(async () => { root.root.findByType("button").props.onClick(); await Promise.resolve() })
    assert.ok(signal)
    await act(async () => { root.unmount() })
    assert.equal(signal.aborted, true)
    await act(async () => { resolveFetch({ ok: true, json: async () => ({ transcript: "private A", language: "en" }) }); await Promise.resolve() })
    assert.equal(transcripts, 0)
    assert.ok(stopped >= 1)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.MediaRecorder = originalRecorder
    Date.now = originalNow
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator)
    else delete globalThis.navigator
  }
})

test("mounted chat drops delayed history and stream after direct actor and session switches", async () => {
  const oldWindow = globalThis.window
  const oldDocument = globalThis.document
  const storage = new Map()
  globalThis.window = { localStorage: {
    getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v),
  }, setTimeout, clearTimeout }
  globalThis.document = { documentElement: { setAttribute() {} } }
  const history = []
  const streams = []
  const api = {
    DEFAULT_CHAT_MODEL_ID: "default", GROQ_MODELS: [],
    getChatHistory: (params) => new Promise((resolve) => history.push({ params, resolve })),
    askQuestionStream: (...args) => new Promise((resolve) => streams.push({ callback: args[8], signal: args[9], resolve })),
    clearChatHistory: async () => ({ deleted_rows: 0 }), listDocuments: async () => [],
  }
  const Wrapper = ({ children }) => React.createElement("div", null, children)
  const stubs = new Proxy({}, { get: (_target, key) => key === "__esModule" ? true : Wrapper })
  const Copy = new Proxy({}, { get: () => "label" })
  const mocks = {
    "@/lib/api": api,
    "@/lib/identity-lifecycle": { createIdentityLifecycle, resolveIdentity },
    "@/lib/utils": { cn: () => "" },
    "@/components/language-provider": { useLanguage: () => ({ language: "en", toggleLanguage() {} }) },
    "@/lib/i18n/chat": { CHAT_COPY: { en: Copy } },
    "@/hooks/useLocalStorageSetting": { useLocalStorageSetting: (_key, initial) => useState(initial) },
    "sonner": { toast: { success() {}, error() {}, info() {} } },
    "framer-motion": stubs, "lucide-react": stubs,
    "next/dynamic": { __esModule: true, default: () => Wrapper },
    "./message-cards": { AIMessageCard: ({ message }) => React.createElement("p", null, message.answer), UserMessageBubble: ({ message }) => React.createElement("p", null, message.question), TypingIndicator: Wrapper },
    "./voice-mic-button": { VoiceMicButton: Wrapper },
    "./empty-state": { EmptyState: ({ onChipClick }) => React.createElement("button", { onClick: () => onChipClick("question A") }, "ask") },
    "./thread-history-panel": { ThreadHistoryPanel: Wrapper },
  }
  for (const id of ["@/components/elements/ai-elements/chat/ai-chat", "@/components/ui/message-scroller", "@/components/ui/attachment", "@/components/elements/ai-elements/chat/chat-input", "@/components/ui/popover", "@/components/ui/dropdown-menu"]) mocks[id] = stubs
  const ChatPanel = load("../components/chat-panel/index.tsx", mocks).default
  const doc = { id: "doc", name: "Document", status: "ready" }
  let workspace
  function Harness() {
    const value = context.useWorkspaceSession()
    workspace = value
    return React.createElement(ChatPanel, { key: `${value.actorGeneration}:${value.sessionGeneration}`, userId: value.userId, sessionId: value.activeSessionId, selectedDoc: doc, documents: [doc] })
  }
  const tree = () => React.createElement(context.WorkspaceSessionProvider, null, React.createElement(Harness))
  let root
  try {
    clerk = { isLoaded: true, isSignedIn: true, user: { id: "A" } }
    await act(async () => { root = renderer.create(tree()) })
    const initialHistory = history.at(-1)
    await act(async () => { initialHistory.resolve([]); await Promise.resolve() })
    await act(async () => { root.root.findAllByType("button").find((b) => b.props.children === "ask").props.onClick() })
    const oldStream = streams.at(-1)
    assert.ok(oldStream)
    clerk = { isLoaded: true, isSignedIn: true, user: { id: "B" } }
    await act(async () => { root.update(tree()) })
    assert.equal(oldStream.signal.aborted, true)
    const oldHistory = history.at(-1)
    await act(async () => { workspace.setActiveSessionId("different") })
    await act(async () => {
      oldHistory.resolve([{ id: "old", session_id: "old", question: "private history A", answer: "secret" }])
      oldStream.callback({ type: "token", text: "private token A" })
      oldStream.callback({ type: "complete", answer: "private answer A", sources: [], language: "en" })
      oldStream.resolve()
      await Promise.resolve()
    })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /private (history|token|answer) A/)
    const currentHistory = history.at(-1)
    await act(async () => { currentHistory.resolve([]); await Promise.resolve() })
    await act(async () => { root.root.findAllByType("button").find((b) => b.props.children === "ask").props.onClick() })
    const sessionStream = streams.at(-1)
    await act(async () => { workspace.setActiveSessionId("another-session") })
    assert.equal(sessionStream.signal.aborted, true)
    await act(async () => {
      sessionStream.callback({ type: "complete", answer: "old session secret", sources: [], language: "en" })
      sessionStream.resolve()
      await Promise.resolve()
    })
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /old session secret/)
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /private (history|token|answer) A/)
  } finally {
    if (root) await act(async () => { root.unmount() })
    globalThis.window = oldWindow
    globalThis.document = oldDocument
  }
})
