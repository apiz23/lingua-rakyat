import Image from "next/image"
import { ArrowRight, ArrowDown, FileText, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LocalizedLink as Link, UiText } from "@/components/i18n"
import { getLocale } from "@/lib/i18n/server"
import Footer from "@/components/footer"
import { TechStackLogos } from "@/components/tech-stack-logos"
import { getLandingCopy, getComparison } from "@/components/landing/content"
import {
  getExperienceCopy,
  TECH_STACK,
} from "@/components/landing/experience-copy"
import { HeroHeading } from "@/components/landing/hero-heading"
import { DocumentStory, AnswerExperience } from "@/components/landing/story"
import { DocumentComparison } from "@/components/landing/comparison"
import { ExperienceShell } from "@/components/landing/experience-shell"
import { LandingDemoPlayer } from "@/components/landing/demo-player"
import styles from "./landing.module.css"

const DEMO_VIDEO_SRC =
  "https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/medium.mp4"

export default async function Home() {
  const language = await getLocale()
  const copy = getLandingCopy(language)
  const experience = getExperienceCopy(language)
  const comparison = getComparison(language)

  return (
    <ExperienceShell>
      <main id="landing-main" tabIndex={-1}>
        <section className={styles.hero} data-hero aria-labelledby="hero-title">
          <div
            className={styles.heroLandscape}
            data-parallax="65"
            aria-hidden="true"
          >
            <Image
              src="/assets/background-new3.webp"
              alt=""
              fill
              sizes="100vw"
              priority
            />
          </div>
          <div className={styles.heroContent}>
            <div id="hero-title">
              <HeroHeading
                key={language}
                first={copy.headline1}
                second={copy.headline2}
              />
            </div>
            <div className={styles.heroIntroduction}>
              <p>{copy.subhead}</p>
              <div className={styles.actions}>
                <Button asChild size="lg">
                  <Link href="/workspace">
                    {copy.cta}
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
                <a href="#demo-section" className={styles.textLink}>
                  {copy.ctaSecondary}
                  <ArrowRight aria-hidden="true" size={18} />
                </a>
              </div>
              <div
                className={styles.languages}
                aria-label={experience.languages}
              >
                <Globe aria-hidden="true" size={16} />
                <span lang="ms">{"Bahasa Melayu"}</span>
                <span lang="en">{"English"}</span>
                <span lang="zh">{"中文"}</span>
              </div>
            </div>
          </div>
          <div
            className={styles.heroArt}
            role="img"
            aria-label={experience.illustration}
          >
            <div className={styles.artOrbit} aria-hidden="true" />
            <div className={styles.heroCard} data-parallax="-65">
              <Image
                src="/assets/MyKad.webp"
                alt=""
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 45vw, 24vw"
              />
            </div>
            <div className={styles.heroPassport} data-parallax="-105">
              <Image
                src="/assets/passport.webp"
                alt=""
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 40vw, 22vw"
              />
            </div>
            <div className={styles.heroPerson} data-parallax="-30">
              <Image
                src="/assets/person.webp"
                alt=""
                width={680}
                height={1024}
                sizes="(max-width: 700px) 62vw, 30vw"
                priority
              />
            </div>
          </div>
          <a href="#the-problem" className={styles.explore}>
            {experience.journey}
            <ArrowDown aria-hidden="true" size={18} />
          </a>
        </section>

        <section
          id="the-problem"
          className={styles.problem}
          aria-labelledby="problem-heading"
        >
          <h2 id="problem-heading">
            {experience.problem.map((line) => (
              <span key={line} data-progress-word>
                {line}
              </span>
            ))}
          </h2>
          <div className={styles.problemNote}>
            <FileText aria-hidden="true" size={28} strokeWidth={1.3} />
            <p>{experience.problemDescription}</p>
            <a href="#the-solution" className={styles.lightLink}>
              {experience.solution}
              <ArrowDown aria-hidden="true" size={20} />
            </a>
          </div>
        </section>

        <section
          id="the-solution"
          className={styles.solution}
          aria-labelledby="solution-heading"
        >
          <div className={styles.solutionArt} data-solution-art>
            <Image
              src="/assets/background-new3.webp"
              alt=""
              fill
              sizes="100vw"
            />
            <span aria-hidden="true">
              <UiText text="Lingua Rakyat" />
            </span>
          </div>
          <div className={styles.solutionCopy}>
            <h2 id="solution-heading">{experience.solution}</h2>
            <div>
              <p>{experience.solutionDescription}</p>
              <a href="#how-it-works" className={styles.textLink}>
                {experience.journey}
                <ArrowDown aria-hidden="true" size={18} />
              </a>
            </div>
          </div>
        </section>

        <DocumentStory copy={experience} />
        <AnswerExperience copy={experience} />

        <section className={styles.features} aria-labelledby="features-heading">
          <div className={styles.featureHeading}>
            <h2 id="features-heading">{copy.whatItDoes}</h2>
            <p>{copy.builtFor}</p>
          </div>
          <div className={styles.featureList}>
            {copy.features.map((feature, index) => (
              <article key={feature.label} data-feature={index}>
                <feature.icon aria-hidden="true" size={30} strokeWidth={1.3} />
                <h3>{feature.label}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <DocumentComparison
          copy={comparison}
          language={language}
          label={experience.comparison}
        />

        <section
          className={styles.technology}
          aria-labelledby="technology-heading"
        >
          <div className={styles.technologyHeading}>
            <h2 id="technology-heading">{experience.stackHeading}</h2>
            <p>{experience.stackDescription}</p>
          </div>
          <TechStackLogos techs={TECH_STACK} />
          <details className={styles.pipeline}>
            <summary>
              {copy.howItWorks}
              <span aria-hidden="true">{"+"}</span>
            </summary>
            <ol>
              {copy.steps.map((step) => (
                <li key={step.n}>
                  <span>{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </section>

        <section
          className={styles.demo}
          id="demo-section"
          aria-labelledby="demo-heading"
        >
          <div className={styles.demoHeading}>
            <h2 id="demo-heading">{copy.watchDemo}</h2>
            <p>{copy.seeItWork}</p>
          </div>
          <div className={styles.video}>
            <LandingDemoPlayer src={DEMO_VIDEO_SRC} />
            <noscript>
              <p>{experience.demoLoading}</p>
              <Link href="/workspace" className={styles.textLink}>
                {copy.cta}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </noscript>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-heading">
          <div className={styles.closingWords} aria-hidden="true">
            {experience.voices.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
          <div className={styles.closingContent}>
            <h2 id="closing-heading">{experience.finalTitle}</h2>
            <div>
              <p>{copy.builtFor}</p>
              <Button asChild size="lg">
                <Link href="/workspace">
                  {copy.cta}
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer editorial />
    </ExperienceShell>
  )
}
