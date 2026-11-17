import Image from "next/image"
import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  FileText,
  MessageCircle,
  Quote,
} from "lucide-react"
import type { getExperienceCopy } from "./experience-copy"
import { SAMPLE_PASSAGE, SAMPLE_PDF } from "./experience-copy"
import { UiText } from "@/components/i18n"
import styles from "@/app/(public)/landing.module.css"

type Copy = ReturnType<typeof getExperienceCopy>

export function DocumentStory({ copy }: { copy: Copy }) {
  return (
    <section
      className={styles.story}
      id="how-it-works"
      aria-labelledby="story-heading"
    >
      <h2 id="story-heading">{copy.storyTitle}</h2>
      <div className={styles.storyGrid} data-story-container>
        <div
          className={styles.storyVisual}
          data-story-visual
          aria-hidden="true"
        >
          <div className={styles.storyPaper}>
            <div>
              <FileText size={24} />
              <span>{"MyKad FAQ"}</span>
              <span>{"01"}</span>
            </div>
            <p lang="ms">{SAMPLE_PASSAGE}</p>
            <div className={styles.paperRules} />
            <Quote size={36} strokeWidth={1} />
          </div>
          <div className={styles.storyLayer} data-story-layer="0">
            <MessageCircle size={28} />
            <span>{copy.stages[0]?.label}</span>
            <p>{copy.question}</p>
            <div className={styles.sceneLanguage}>
              <span>{"BM"}</span>
              <span>{"EN"}</span>
              <span>{"中文"}</span>
            </div>
          </div>
          <div className={styles.storyLayer} data-story-layer="1">
            <BookOpen size={28} />
            <span>{copy.stages[1]?.label}</span>
            <p>{copy.answer}</p>
            <span className={styles.citationMark}>{"[1]"}</span>
          </div>
          <div className={styles.storyLayer} data-story-layer="2">
            <Quote size={28} />
            <span>{copy.stages[2]?.label}</span>
            <p lang="ms">{SAMPLE_PASSAGE}</p>
            <span className={styles.sceneSource}>{copy.sourceLabel}</span>
          </div>
          <div className={styles.storyProgress}>
            <span data-story-progress />
          </div>
        </div>
        <ol className={styles.storySteps}>
          {copy.stages.map((stage, index) => (
            <li key={stage.title} id={`story-step-${index}`} data-story-step>
              <span className={styles.stepNumber}>{`0${index + 1}`}</span>
              <h3>
                <a
                  href={`#story-step-${index}`}
                  aria-label={`${copy.stepLabel} ${index + 1}: ${stage.title}`}
                >
                  {stage.title}
                  <ArrowDown aria-hidden="true" size={20} />
                </a>
              </h3>
              <p>{stage.description}</p>
              <p className={styles.stageDetail}>{stage.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function AnswerExperience({ copy }: { copy: Copy }) {
  return (
    <section
      className={styles.sample}
      id="sample-answer"
      aria-labelledby="sample-heading"
    >
      <div className={styles.sampleHeading}>
        <h2 id="sample-heading">{copy.sampleTitle}</h2>
        <p>{copy.sampleDescription}</p>
      </div>
      <div className={styles.answerSpread}>
        <article
          className={styles.answerPage}
          aria-label={copy.stages[1]?.label}
        >
          <div className={styles.previewHeader}>
            <Image
              src="/icons/android-chrome-512x512.png"
              alt=""
              width={28}
              height={28}
            />
            <span>
              <UiText text="Lingua Rakyat" />
            </span>
            <span>{copy.stages[1]?.label}</span>
          </div>
          <div className={styles.question}>
            <MessageCircle aria-hidden="true" size={20} />
            <p>{copy.question}</p>
          </div>
          <div className={styles.answer}>
            <BookOpen aria-hidden="true" size={24} />
            <p>
              {copy.answer}{" "}
              <a
                href="#sample-source"
                className={styles.citationLink}
                aria-label={copy.sourceLabel}
              >
                {"[1]"}
              </a>
            </p>
          </div>
        </article>
        <article className={styles.sourcePage} id="sample-source" tabIndex={-1}>
          <h3>{copy.sourceHeading}</h3>
          <p className={styles.sourceLabel}>{copy.sourceLabel}</p>
          <blockquote cite={SAMPLE_PDF} lang="ms">
            <Quote aria-hidden="true" size={28} strokeWidth={1.5} />
            <p>{SAMPLE_PASSAGE}</p>
          </blockquote>
          <a
            href={SAMPLE_PDF}
            className={styles.textLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.openSource}
            <ArrowUpRight aria-hidden="true" size={18} />
            <span className="sr-only">
              <UiText text="(opens in a new tab)" />
            </span>
          </a>
        </article>
      </div>
      <p className={styles.disclaimer}>{copy.disclaimer}</p>
    </section>
  )
}
