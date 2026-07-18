// Trilingual UI copy — mirrors the web app's language set (ms | en | zh).

export type AppLanguage = "ms" | "en" | "zh"

export type Copy = {
  appName: string
  tagline: string
  documents: string
  ready: string
  processing: string
  noDocs: string
  loadError: string
  retry: string
  chunks: string
  allDocsNote: string
  askPlaceholder: string
  send: string
  thinking: string
  sources: string
  page: string
  suggestions: string
  answerError: string
  rateLimited: string
  back: string
  newChat: string
  menu: string
  mentionTitle: string
  mentionNoMatch: string
  pinnedNote: string
  emptyHint: string
  readyDocsSuffix: string
  account: string
  signInGoogle: string
  signInGitHub: string
  signOut: string
  signInError: string
  profileTab: string
  signedInAs: string
  guest: string
  signInPrompt: string
  language: string
  version: string
}

export const COPY: Record<AppLanguage, Copy> = {
  ms: {
    appName: "Lingua Rakyat",
    tagline: "Jawapan dokumen kerajaan, dalam bahasa anda",
    documents: "Dokumen",
    ready: "Sedia",
    processing: "Diproses",
    noDocs: "Tiada dokumen tersedia buat masa ini.",
    loadError: "Gagal memuatkan dokumen",
    retry: "Cuba lagi",
    chunks: "petikan",
    allDocsNote: "Soalan merangkumi semua dokumen sedia",
    askPlaceholder: "Tanya soalan...",
    send: "Hantar",
    thinking: "Sedang mencari jawapan...",
    sources: "Sumber",
    page: "m/s",
    suggestions: "Cuba tanya:",
    answerError: "Gagal mendapatkan jawapan. Cuba lagi.",
    rateLimited: "Terlalu banyak soalan. Tunggu sebentar...",
    back: "Kembali",
    newChat: "Sembang baharu",
    menu: "Menu",
    mentionTitle: "Tanya dokumen tertentu",
    mentionNoMatch: "Tiada dokumen sepadan",
    pinnedNote: "Soalan guna dokumen ini sahaja",
    emptyHint: "Taip @ untuk pilih dokumen tertentu",
    readyDocsSuffix: "dokumen sedia",
    account: "Akaun",
    signInGoogle: "Log masuk dengan Google",
    signInGitHub: "Log masuk dengan GitHub",
    signOut: "Log keluar",
    signInError: "Log masuk gagal. Cuba lagi.",
    profileTab: "Profil",
    signedInAs: "Log masuk sebagai",
    guest: "Pengguna tetamu",
    signInPrompt:
      "Log masuk untuk simpan sejarah sembang anda merentas peranti.",
    language: "Bahasa",
    version: "Versi",
  },
  en: {
    appName: "Lingua Rakyat",
    tagline: "Government document answers, in your language",
    documents: "Documents",
    ready: "Ready",
    processing: "Processing",
    noDocs: "No documents available yet.",
    loadError: "Failed to load documents",
    retry: "Retry",
    chunks: "sections",
    allDocsNote: "Questions span every ready document",
    askPlaceholder: "Ask a question...",
    send: "Send",
    thinking: "Finding your answer...",
    sources: "Sources",
    page: "p.",
    suggestions: "Try asking:",
    answerError: "Failed to get an answer. Please try again.",
    rateLimited: "Too many questions. Please wait...",
    back: "Back",
    newChat: "New chat",
    menu: "Menu",
    mentionTitle: "Ask a specific document",
    mentionNoMatch: "No matching documents",
    pinnedNote: "Questions use only this document",
    emptyHint: "Type @ to pick a specific document",
    readyDocsSuffix: "documents ready",
    account: "Account",
    signInGoogle: "Sign in with Google",
    signInGitHub: "Sign in with GitHub",
    signOut: "Sign out",
    signInError: "Sign-in failed. Please try again.",
    profileTab: "Profile",
    signedInAs: "Signed in as",
    guest: "Guest user",
    signInPrompt: "Sign in to keep your chat history across devices.",
    language: "Language",
    version: "Version",
  },
  zh: {
    appName: "Lingua Rakyat",
    tagline: "政府文件解答，用您的语言",
    documents: "文件",
    ready: "就绪",
    processing: "处理中",
    noDocs: "暂无可用文件。",
    loadError: "无法加载文件",
    retry: "重试",
    chunks: "段落",
    allDocsNote: "问题将检索所有就绪文件",
    askPlaceholder: "输入问题...",
    send: "发送",
    thinking: "正在查找答案...",
    sources: "来源",
    page: "页",
    suggestions: "试试问：",
    answerError: "获取回答失败，请重试。",
    rateLimited: "提问过于频繁，请稍候...",
    back: "返回",
    newChat: "新对话",
    menu: "菜单",
    mentionTitle: "查询特定文件",
    mentionNoMatch: "没有匹配的文件",
    pinnedNote: "问题仅使用此文件",
    emptyHint: "输入 @ 选择特定文件",
    readyDocsSuffix: "个文件就绪",
    account: "账户",
    signInGoogle: "使用 Google 登录",
    signInGitHub: "使用 GitHub 登录",
    signOut: "退出登录",
    signInError: "登录失败，请重试。",
    profileTab: "个人",
    signedInAs: "当前登录",
    guest: "访客用户",
    signInPrompt: "登录以在多设备间保存聊天记录。",
    language: "语言",
    version: "版本",
  },
}

export const NEXT_LANGUAGE: Record<AppLanguage, AppLanguage> = {
  ms: "en",
  en: "zh",
  zh: "ms",
}

export const LANGUAGE_LABEL: Record<AppLanguage, string> = {
  ms: "BM",
  en: "EN",
  zh: "中文",
}
