import { Check } from "lucide-react"
import { UiText } from "@/components/i18n"
import type { getComparison } from "./content"
import styles from "@/app/(public)/landing.module.css"

export function DocumentComparison({
  copy,
  language,
  label,
}: {
  copy: ReturnType<typeof getComparison>
  language: string
  label: string
}) {
  return (
    <section className={styles.comparison} aria-label={label}>
      <details>
        <summary>
          <span>{label}</span>
          <span aria-hidden="true">{"+"}</span>
        </summary>
        <div className={styles.comparisonHeading}>
          <h2 id="comparison-heading">{copy.title}</h2>
          <p>{copy.subhead}</p>
        </div>
        <div
          className={styles.tableScroll}
          role="region"
          aria-labelledby="comparison-heading"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">{copy.subhead}</caption>
            <thead>
              <tr>
                <th scope="col">
                  <UiText text="Feature" />
                </th>
                {copy.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copy.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={copy.columns[index]}>
                      {value ? (
                        <>
                          <Check aria-hidden="true" size={18} />
                          <span className="sr-only">
                            <UiText text="yes" />
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">{"—"}</span>
                          <span className="sr-only">
                            {language === "ms" ? "Tidak" : "No"}
                          </span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.footnote}>{copy.footnote}</p>
      </details>
    </section>
  )
}
