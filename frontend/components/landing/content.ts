import type { Locale } from "@/lib/i18n/routing"
import {
  FileSearch,
  BarChart3,
  Zap,
  Target,
  FileText,
  Languages,
  Globe,
  Mic,
  Shield,
} from "lucide-react"

export function getLandingCopy(language: Locale | "zh") {
  const copy =
    language === "ms"
      ? {
          kicker: "AI Multilingual untuk Dokumen Kerajaan",
          headline1: "Dokumen kerajaan.",
          headline2: "Dalam bahasa anda.",

          subhead:
            "Tanya tentang dokumen kerajaan Malaysia dalam Bahasa Melayu, English atau Mandarin. Baca penerangan dan semak petikan sumber yang disertakan.",

          cta: "Tanya soalan",
          ctaSecondary: "Tonton Demo",

          strip: [
            { icon: FileSearch, label: "Carian Semantik" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Inferens Pantas" },
            { icon: Target, label: "Skor Keyakinan" },
          ],

          howItWorks: "Cara jawapan dihasilkan",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "Sistem mengekstrak teks PDF, membahagikannya kepada petikan dan mengindeksnya untuk carian.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "Sistem mencari petikan yang sepadan dengan soalan anda, kemudian menyusunnya mengikut kesesuaian.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "Sistem menyemak bukti yang ditemui, menjana jawapan dan menyertakan petikan sumber serta skor penilaian jawapan.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Alat untuk membaca dokumen",

          builtFor:
            "Tanya soalan, semak sumber dan lihat cara jawapan dinilai.",

          features: [
            {
              label: "Jawapan pelbagai bahasa",
              desc: "Tanya soalan dan baca jawapan dalam Bahasa Melayu, English atau Mandarin.",
              icon: Globe,
            },
            {
              label: "Penilaian jawapan",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, serta metrik masa nyata.",
              icon: BarChart3,
            },
            {
              label: "Tanya dan dengar melalui suara",
              desc: "Tanya soalan melalui suara dan dengar jawapan dibacakan.",
              icon: Mic,
            },
            {
              label: "Semakan bukti",
              desc: "Menyemak bukti sebelum menjawab dan menilai sejauh mana jawapan mengikuti sumbernya.",
              icon: Shield,
            },
          ],

          watchDemo: "Tonton demo",
          seeItWork: "Soal jawab menggunakan dokumen kerajaan",

          builtWith: "Teknologi",

          previewQ: "Soalan: Siapakah yang layak memohon bantuan ini?",
          previewA:
            "Dalam contoh rekaan ini, Seksyen 2.1 menetapkan kewarganegaraan Malaysia, umur minimum 18 tahun dan had pendapatan isi rumah RM4,000.",
          sampleTitle: "Lihat contoh jawapan",
          sampleDescription:
            "Jawapan dipadankan dengan petikan sumber supaya anda boleh menyemaknya.",
          sampleCta: "Tanya soalan anda",
          sampleNote: "Pratonton contoh — bukan nasihat rasmi",
          previewSrc: "Petikan sumber · Pratonton",
        }
      : {
          kicker: "Multilingual AI for Government Documents",

          headline1: "Government documents.",
          headline2: "In your language.",

          subhead:
            "Ask about Malaysian government documents in Malay, English or Chinese. Read an explanation and check the source passages included with the answer.",

          cta: "Ask a question",
          ctaSecondary: "Watch Demo",

          strip: [
            { icon: FileSearch, label: "Semantic Search" },
            { icon: BarChart3, label: "ROUGE-1/2/L" },
            { icon: Zap, label: "Fast Inference" },
            { icon: Target, label: "Confidence Scoring" },
          ],

          howItWorks: "How answers are produced",

          steps: [
            {
              n: "01",
              title: "Ingestion",
              desc: "The system extracts text from PDFs, splits it into passages and indexes them for search.",
              icon: FileText,
            },
            {
              n: "02",
              title: "Retrieval",
              desc: "The system searches for passages that match your question, then ranks them by relevance.",
              icon: Languages,
            },
            {
              n: "03",
              title: "Generation",
              desc: "The system checks the matching passages and writes an answer with source citations and evaluation scores.",
              icon: FileSearch,
            },
          ],

          whatItDoes: "Tools for reading documents",

          builtFor:
            "Ask questions, check sources and see how answers are evaluated.",

          features: [
            {
              label: "Multilingual answers",
              desc: "Ask questions and read answers in Malay, English or Chinese.",
              icon: Globe,
            },
            {
              label: "Answer evaluation",
              desc: "ROUGE, BLEU, Flesch-Kincaid, exact match, and real-time metrics.",
              icon: BarChart3,
            },
            {
              label: "Ask and listen by voice",
              desc: "Ask a question by voice and listen to the answer read aloud.",
              icon: Mic,
            },
            {
              label: "Evidence checks",
              desc: "Checks the source passages before answering and scores how closely the answer follows them.",
              icon: Shield,
            },
          ],

          watchDemo: "Watch the demo",
          seeItWork: "Questions and answers with government documents",

          builtWith: "Technology",

          previewQ: "Who is eligible to apply for this benefit?",
          previewA:
            "In this example, Section 2.1 requires Malaysian citizenship, an age of at least 18 and household income of RM4,000 or less.",
          sampleTitle: "See a sample answer",
          sampleDescription:
            "Read the answer alongside its source passage to check the details.",
          sampleCta: "Ask your own question",
          sampleNote: "Example preview — not official guidance",
          previewSrc: "Source excerpt · Preview",
        }

  return copy
}

export function getComparison(language: Locale | "zh") {
  const comparison =
    language === "ms"
      ? {
          kicker: "Document Q&A comparison",
          title: "Soal jawab dokumen dengan sumber untuk disemak.",
          subhead:
            "Bandingkan sokongan bahasa, petikan sumber dan alat untuk menyemak jawapan.",
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "NotebookLM",
            "Claude Projects",
          ],
          rows: [
            {
              label: "Bahasa Melayu natural",
              values: [true, true, true, true],
            },
            {
              label: "Fokus dokumen kerajaan Malaysia",
              values: [true, false, false, false],
            },
            {
              label: "Sumber + halaman PDF",
              values: [true, true, true, true],
            },
            {
              label: "Badge keyakinan",
              values: [true, false, false, false],
            },
            {
              label: "Carian semantik multilingual",
              values: [true, true, true, true],
            },
            {
              label: "Akses dokumen awam (baca sahaja)",
              values: [true, false, true, true],
            },
            {
              label: "Metrik penilaian (ROUGE/BLEU)",
              values: [true, false, false, false],
            },
            {
              label: "Skor ketepatan sumber (faithfulness)",
              values: [true, false, false, false],
            },
            {
              label: "Suara I/O (STT + TTS)",
              values: [true, true, true, false],
            },
          ],
          footnote:
            "Nota: Sambungan internet diperlukan untuk mengakses dokumen dan jawapan.",
        }
      : {
          kicker: "Document Q&A comparison",
          title: "Document questions, with sources you can check.",
          subhead:
            "Compare language support, source citations and tools for reviewing answers.",
          columns: [
            "Lingua Rakyat",
            "ChatGPT + PDF upload",
            "NotebookLM",
            "Claude Projects",
          ],
          rows: [
            {
              label: "Natural Malay support",
              values: [true, true, true, true],
            },
            {
              label: "Malaysia government-first",
              values: [true, false, false, false],
            },
            {
              label: "PDF citations and pages",
              values: [true, true, true, true],
            },
            {
              label: "Confidence badge",
              values: [true, false, false, false],
            },
            {
              label: "Multilingual semantic retrieval",
              values: [true, true, true, true],
            },
            {
              label: "Document management",
              values: [true, false, true, true],
            },
            {
              label: "Answer evaluation metrics",
              values: [true, false, false, false],
            },
            {
              label: "Answer-to-source comparison",
              values: [true, false, false, false],
            },
            {
              label: "Voice questions and playback",
              values: [true, true, true, false],
            },
          ],
          footnote:
            "Note: An internet connection is required to access documents and answers.",
        }

  return comparison
}
