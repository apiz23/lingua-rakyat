import type { Locale } from "@/lib/i18n/routing"

export function getExperienceCopy(language: Locale | "zh") {
  return language === "ms"
    ? {
        problem: [
          "Dokumen panjang.",
          "Istilah yang asing.",
          "Soalan seharian.",
        ],
        problemDescription:
          "Maklumat awam perlu difahami sebelum dapat digunakan.",
        solution: "Kenali Lingua Rakyat.",
        solutionDescription:
          "Daripada dokumen kepada penerangan. Daripada penerangan kepada sumber yang boleh disemak.",
        storyTitle: "Dari soalan, hingga kefahaman.",
        stages: [
          {
            title: "Tanya dalam bahasa anda.",
            description: "Mulakan dengan soalan tentang dokumen awam.",
            detail: "Bahasa Melayu, English atau Mandarin.",
            label: "Soalan",
          },
          {
            title: "Fahami jawapan.",
            description: "Dapatkan penerangan yang jelas dan mudah dibaca.",
            detail: "Baca penerangan mengikut konteks soalan anda.",
            label: "Penerangan",
          },
          {
            title: "Semak sumber.",
            description: "Rujuk petikan dan sahkan dengan sumber rasmi.",
            detail: "Kembali kepada dokumen untuk menyemak butirannya.",
            label: "Sumber",
          },
        ],
        question: "Bilakah saya perlu menggantikan MyKad pertama saya?",
        answer:
          "Menurut contoh FAQ ini, MyKad pertama yang diterima pada umur 12 tahun perlu diganti apabila pemegang mencapai umur 18 tahun.",
        sourceHeading: "Baca petikan asal.",
        sourceLabel: "MyKad FAQ · Halaman 1 · Soalan 1",
        openSource: "Buka dokumen contoh",
        disclaimer:
          "Contoh daripada PDF sampel projek — bukan nasihat rasmi. Semak keperluan semasa dengan JPN.",
        sampleTitle: "Jawapan yang boleh anda semak.",
        sampleDescription:
          "Ikuti contoh daripada soalan, kepada penerangan, kemudian kepada petikan asalnya.",
        journey: "Terokai cara ia berfungsi",
        stepLabel: "Langkah",
        voices: ["Tanya.", "Fahami.", "Semak."],
        stackHeading: "Di sebalik setiap jawapan.",
        stackDescription:
          "Alat yang digunakan oleh Lingua Rakyat untuk menyimpan dokumen, mencari petikan dan menjana jawapan.",
        finalTitle: "Soalan anda.\nBahasa anda.",
        illustration: "Ilustrasi panduan sivik dengan dokumen pengenalan",
        languages: "Bahasa jawapan",
        comparison: "Bandingkan alat soal jawab dokumen",
        demoLoading:
          "Pemain demo memerlukan JavaScript. Anda juga boleh meneroka ruang kerja.",
      }
    : {
        problem: [
          "Long documents.",
          "Unfamiliar terms.",
          "Everyday questions.",
        ],
        problemDescription:
          "Public information needs to be understood before it can be used.",
        solution: "Meet Lingua Rakyat.",
        solutionDescription:
          "From a document to an explanation. From an explanation to a source you can check.",
        storyTitle: "From a question, to understanding.",
        stages: [
          {
            title: "Ask in your language.",
            description: "Start with a question about public documents.",
            detail: "Malay, English or Chinese.",
            label: "Question",
          },
          {
            title: "Understand the answer.",
            description: "Get a clear explanation you can follow.",
            detail: "Read an explanation in the context of your question.",
            label: "Explanation",
          },
          {
            title: "Check the source.",
            description: "Follow citations and verify with official sources.",
            detail: "Return to the document to check the details.",
            label: "Source",
          },
        ],
        question: "When should I replace my first MyKad?",
        answer:
          "The sample FAQ says a first MyKad issued at age 12 should be replaced when the holder turns 18.",
        sourceHeading: "Read the original passage.",
        sourceLabel: "MyKad FAQ · Page 1 · Question 1",
        openSource: "Open sample document",
        disclaimer:
          "Example from the project’s sample PDF — not official guidance. Check current requirements with JPN.",
        sampleTitle: "An answer you can check.",
        sampleDescription:
          "Follow one example from the question, to an explanation, to its original passage.",
        journey: "Explore how it works",
        stepLabel: "Step",
        voices: ["Ask.", "Understand.", "Verify."],
        stackHeading: "Behind every answer.",
        stackDescription:
          "The tools Lingua Rakyat uses to store documents, search passages and write answers.",
        finalTitle: "Your question.\nYour language.",
        illustration: "Civic guide illustration with identity documents",
        languages: "Answer languages",
        comparison: "Compare document question-and-answer tools",
        demoLoading:
          "The demo player requires JavaScript. You can also explore the workspace.",
      }
}

export const SAMPLE_PASSAGE =
  "Seseorang yang telah mendapat kad pengenalan kali pertama iaitu semasa berumur 12 tahun, dikehendaki menukar semula kad pengenalannya apabila telah mencapai umur 18 tahun."
export const SAMPLE_PDF = "/samples/MyKad_FAQ.pdf#page=1"
export const TECH_STACK = [
  { name: "Next.js", url: "https://nextjs.org" },
  { name: "FastAPI", url: "https://fastapi.tiangolo.com" },
  { name: "Pinecone", url: "https://pinecone.io" },
  { name: "Cohere", url: "https://cohere.com" },
  { name: "Groq", url: "https://groq.com" },
  { name: "Supabase", url: "https://supabase.com" },
]
