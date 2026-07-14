// Suggested questions keyed by the agencies actually seeded in
// backend/routers/documents.py FEATURED_DOCS. Keep in sync if that list
// changes — a question referencing an agency with no doc yields
// evidence_mode: "insufficient" instead of a real answer.

export type Lang = "ms" | "en" | "zh"

export const AGENCY_QUESTION_MAP: Record<string, Record<Lang, string[]>> = {
  JPN: {
    ms: ["Bagaimana cara memperbaharui MyKad?"],
    en: ["How do I renew my MyKad?"],
    zh: ["如何更新我的MyKad身份证？"],
  },
  IMIGRESEN: {
    ms: ["Apa dokumen diperlukan untuk permohonan pasport?"],
    en: ["What documents do I need to apply for a passport?"],
    zh: ["申请护照需要哪些文件？"],
  },
  KWSP: {
    ms: ["Bagaimana cara reset kata laluan i-Akaun KWSP?"],
    en: ["How do I reset my KWSP i-Akaun password?"],
    zh: ["如何重置我的公积金 i-Akaun 密码？"],
  },
  PTPTN: {
    ms: ["Siapa layak memohon myWaqafPTPTN?"],
    en: ["Who is eligible to apply for myWaqafPTPTN?"],
    zh: ["谁有资格申请 myWaqafPTPTN？"],
  },
}

export const GENERIC_ASK_CHIP: Record<Lang, string> = {
  ms: "Tanya apa-apa tentang dokumen anda",
  en: "Ask anything about your documents",
  zh: "询问关于您文件的任何问题",
}

export const GENERIC_DOC_QUESTION: Record<Lang, (docName: string) => string> = {
  ms: (docName) => `Apa kandungan ${docName}?`,
  en: (docName) => `What does ${docName} cover?`,
  zh: (docName) => `${docName}包含哪些内容？`,
}
