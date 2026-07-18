// Trilingual UI copy for the chat panel. Keyed by AppLanguage ("ms" | "en" | "zh")
// so 中文 users get a fully translated chrome, not English fallback.

export type ChatCopy = {
  historyLoadError: string
  retryLater: string
  noDoc: string
  noDocDesc: string
  ready: string
  autoServer: string
  newChat: string
  smartOn: string
  smartOff: string
  askAll: string
  askOne: string
  allDocsBadge: string
  clearThread: string
  history: string
  hideHistory: string
  exportHistory: string
  threadList: string
  threadDesc: string
  noSavedThreads: string
  messages: string
  askAbout: string
  answerDesc: string
  suggestions: string
  askPlaceholder: string
  selectDocPlaceholder: string
  send: string
  newLine: string
  voiceStart: string
  voiceStop: string
  voiceUnsupported: string
  voiceBlocked: string
  voiceUnavailable: string
  thread: string
  tooManyQuestions: string
  waitAgain: string
  seconds: string
  copied: string
  newChatStarted: string
  cleared: string
  nothingToClear: string
  clearError: string
  currentThread: string
  language: string
  options: string
  back: string
  answerError: string
  autoSpeakTitle: string
  autoSpeakShort: string
  textSizeLarge: string
  textSizeNormal: string
  simpleViewOn: string
  simpleViewOff: string
  selectDocFirst: string
  userNotReady: string
  sessionNotReady: string
  mentionListTitle: string
  mentionNoMatch: string
  mentionOnlyTitle: string
  modelTitle: string
  scopeTitle: string
  scopeOneShort: string
}

export const CHAT_COPY: Record<"ms" | "en" | "zh", ChatCopy> = {
  ms: {
    historyLoadError: "Gagal memuatkan sejarah sembang",
    retryLater: "Sila cuba lagi sebentar nanti.",
    noDoc: "Tiada dokumen dipilih",
    noDocDesc:
      "Pilih dokumen dari panel kiri untuk mula bertanya dan dapatkan jawapan berasaskan AI.",
    ready: "Sedia",
    autoServer: "Auto (lalai pelayan)",
    newChat: "Sembang baharu",
    smartOn: "Carian Pintar On",
    smartOff: "Carian Pintar Off",
    askAll: "Tanya semua dokumen",
    askOne: "Tanya dokumen ini sahaja",
    allDocsBadge: "Semua dokumen",
    clearThread: "Padam thread semasa",
    history: "Sejarah sembang",
    hideHistory: "Sembunyikan sejarah",
    exportHistory: "Eksport sejarah",
    threadList: "Thread Sembang",
    threadDesc: "Tukar antara thread yang disimpan untuk dokumen ini.",
    noSavedThreads: "Belum ada thread disimpan untuk dokumen ini.",
    messages: "mesej",
    askAbout: "Tanya apa sahaja tentang",
    answerDesc: "dan dapatkan jawapan yang ringkas, jelas, serta bersumber.",
    suggestions: "Cuba tanya tentang:",
    askPlaceholder: "Tanya soalan...",
    selectDocPlaceholder: "Pilih dokumen untuk bermula...",
    send: "Hantar",
    newLine: "Baris baharu",
    voiceStart: "Mulakan input suara",
    voiceStop: "Hentikan input suara",
    voiceUnsupported: "Pelayar ini tidak menyokong input suara secara langsung.",
    voiceBlocked:
      "Akses mikrofon disekat. Sila benarkan mikrofon dan cuba semula.",
    voiceUnavailable: "Input suara tidak tersedia sekarang. Sila cuba lagi.",
    thread: "Thread",
    tooManyQuestions: "Terlalu banyak soalan dihantar",
    waitAgain: "Sila tunggu",
    seconds: "saat sebelum bertanya semula.",
    copied: "Berjaya disalin",
    newChatStarted: "Sembang baharu dimulakan",
    cleared: "Thread semasa dipadam",
    nothingToClear: "Tiada apa untuk dipadam",
    clearError: "Gagal memadam thread semasa",
    currentThread: "Thread semasa",
    language: "Tukar bahasa",
    options: "Pilihan",
    back: "Kembali",
    answerError: "Gagal mendapatkan jawapan",
    autoSpeakTitle: "Auto-baca jawapan",
    autoSpeakShort: "Auto-baca",
    textSizeLarge: "Tukar ke teks besar",
    textSizeNormal: "Tukar ke teks biasa",
    simpleViewOn: "Paparan ringkas",
    simpleViewOff: "Papar butiran teknikal",
    selectDocFirst: "Sila pilih dokumen dahulu",
    userNotReady: "Identiti pengguna belum sedia",
    sessionNotReady: "Sesi belum sedia",
    mentionListTitle: "Tanya dokumen tertentu",
    mentionNoMatch: "Tiada dokumen sepadan",
    mentionOnlyTitle: "Soalan hanya akan guna dokumen ini",
    modelTitle: "Model AI",
    scopeTitle: "Skop carian",
    scopeOneShort: "Dokumen ini",
  },
  en: {
    historyLoadError: "Failed to load chat history",
    retryLater: "Please try again later.",
    noDoc: "No document selected",
    noDocDesc:
      "Select a document from the left panel to start asking questions and get AI-powered answers.",
    ready: "Ready",
    autoServer: "Auto (server default)",
    newChat: "New chat",
    smartOn: "Smart Retrieval On",
    smartOff: "Smart Retrieval Off",
    askAll: "Ask all documents",
    askOne: "Ask this document only",
    allDocsBadge: "All documents",
    clearThread: "Clear current thread",
    history: "Chat history",
    hideHistory: "Hide history",
    exportHistory: "Export history",
    threadList: "Chat Threads",
    threadDesc: "Switch between saved chats for this document.",
    noSavedThreads: "No saved chats for this document yet.",
    messages: "messages",
    askAbout: "Ask anything about",
    answerDesc: "and get simple, clear answers with sources.",
    suggestions: "Try asking about:",
    askPlaceholder: "Ask a question...",
    selectDocPlaceholder: "Select a document to start...",
    send: "Send",
    newLine: "New line",
    voiceStart: "Start voice input",
    voiceStop: "Stop voice input",
    voiceUnsupported: "This browser does not support built-in voice input.",
    voiceBlocked:
      "Microphone access was blocked. Please allow it and try again.",
    voiceUnavailable: "Voice input is unavailable right now. Please try again.",
    thread: "Thread",
    tooManyQuestions: "Too many questions sent",
    waitAgain: "Please wait",
    seconds: "seconds before asking again.",
    copied: "Copied to clipboard",
    newChatStarted: "Started a new chat",
    cleared: "Current chat cleared",
    nothingToClear: "Nothing to clear",
    clearError: "Failed to clear current chat",
    currentThread: "Current chat",
    language: "Toggle language",
    options: "Options",
    back: "Back",
    answerError: "Failed to get answer",
    autoSpeakTitle: "Auto-read answers",
    autoSpeakShort: "Auto-read",
    textSizeLarge: "Switch to large text size",
    textSizeNormal: "Switch to normal text size",
    simpleViewOn: "Simple view",
    simpleViewOff: "Show technical details",
    selectDocFirst: "Please select a document first",
    userNotReady: "User identity not ready yet",
    sessionNotReady: "Session not ready yet",
    mentionListTitle: "Ask a specific document",
    mentionNoMatch: "No matching documents",
    mentionOnlyTitle: "Questions will use only this document",
    modelTitle: "AI model",
    scopeTitle: "Search scope",
    scopeOneShort: "This document",
  },
  zh: {
    historyLoadError: "无法加载聊天记录",
    retryLater: "请稍后再试。",
    noDoc: "未选择文件",
    noDocDesc: "从左侧面板选择文件，开始提问并获取 AI 解答。",
    ready: "就绪",
    autoServer: "自动（服务器默认）",
    newChat: "新对话",
    smartOn: "智能检索开启",
    smartOff: "智能检索关闭",
    askAll: "查询所有文件",
    askOne: "仅查询此文件",
    allDocsBadge: "所有文件",
    clearThread: "清除当前对话",
    history: "聊天记录",
    hideHistory: "隐藏记录",
    exportHistory: "导出记录",
    threadList: "聊天会话",
    threadDesc: "切换此文件已保存的会话。",
    noSavedThreads: "此文件暂无保存的会话。",
    messages: "条消息",
    askAbout: "随时提问关于",
    answerDesc: "获取简洁、清晰、有来源的解答。",
    suggestions: "试试问：",
    askPlaceholder: "输入问题...",
    selectDocPlaceholder: "选择文件开始...",
    send: "发送",
    newLine: "换行",
    voiceStart: "开始语音输入",
    voiceStop: "停止语音输入",
    voiceUnsupported: "此浏览器不支持内置语音输入。",
    voiceBlocked: "麦克风权限被拒绝。请允许后重试。",
    voiceUnavailable: "语音输入暂不可用。请重试。",
    thread: "会话",
    tooManyQuestions: "提问过于频繁",
    waitAgain: "请等待",
    seconds: "秒后再提问。",
    copied: "已复制",
    newChatStarted: "已开始新对话",
    cleared: "当前对话已清除",
    nothingToClear: "没有可清除的内容",
    clearError: "清除当前对话失败",
    currentThread: "当前对话",
    language: "切换语言",
    options: "选项",
    back: "返回",
    answerError: "获取回答失败",
    autoSpeakTitle: "自动朗读回答",
    autoSpeakShort: "自动朗读",
    textSizeLarge: "切换到大字体",
    textSizeNormal: "切换到普通字体",
    simpleViewOn: "简洁模式",
    simpleViewOff: "显示技术详情",
    selectDocFirst: "请先选择文件",
    userNotReady: "用户身份尚未就绪",
    sessionNotReady: "会话尚未就绪",
    mentionListTitle: "查询特定文件",
    mentionNoMatch: "没有匹配的文件",
    mentionOnlyTitle: "问题仅使用此文件",
    modelTitle: "AI 模型",
    scopeTitle: "搜索范围",
    scopeOneShort: "此文件",
  },
}
