import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
const en = read("lib/i18n/en.json")
const ms = read("lib/i18n/ms.json")
const files = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)
          ? [path.join(dir, e.name)]
          : []
    )
const issues = []
const used = new Set()
const placeholders = (value) =>
  [...value.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",")
if (
  JSON.stringify(Object.keys(en).sort()) !==
  JSON.stringify(Object.keys(ms).sort())
)
  issues.push("English and Malay catalog keys differ")
for (const [key, value] of Object.entries(ms)) {
  if (key && key !== "&nbsp;" && !value.trim())
    issues.push(`Empty translation: ${key}`)
  if (placeholders(key) !== placeholders(value))
    issues.push(`Placeholder mismatch: ${key}`)
  if (/\uFFFD/.test(key + value)) issues.push(`Invalid Unicode: ${key}`)
}
for (const file of [...files("app"), ...files("components"), 'lib/admin-nav.ts']) {
  const source = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const location = (n) =>
    `${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`
  const key = (value, n) => {
    value = value.replace(/\s+/g, " ").trim()
    used.add(value)
    if (!Object.hasOwn(en, value) || !Object.hasOwn(ms, value))
      issues.push(`${location(n)} Missing key: ${value}`)
  }
  const visit = (n) => {
    if ((file.endsWith('layout.tsx') || file === 'lib/admin-nav.ts') && ts.isPropertyAssignment(n) && n.name.getText(sf) === 'label' && ts.isStringLiteral(n.initializer)) key(n.initializer.text,n)
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(sf) === "t" &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    )
      key(n.arguments[0].text, n)
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === "UiText") {
      const attr = n.attributes.properties.find(
        (p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "text"
      )
      if (attr?.initializer && ts.isStringLiteral(attr.initializer))
        key(attr.initializer.text, n)
    }
    if (
      ts.isJsxText(n) &&
      /[a-zA-Z]{2}/.test(n.text) &&
      n.text.trim() !== "/docs"
    )
      issues.push(`${location(n)} Hardcoded JSX text: ${n.text.trim()}`)
    if (
      ts.isJsxAttribute(n) &&
      ["value", "href", "id", "name"].includes(n.name.getText(sf)) &&
      n.initializer &&
      ts.isJsxExpression(n.initializer) &&
      n.initializer.expression &&
      ts.isCallExpression(n.initializer.expression) &&
      n.initializer.expression.expression.getText(sf) === "t"
    )
      issues.push(`${location(n)} Machine value must not be translated`)
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
console.log(
  `${Object.keys(en).length} catalog keys; ${used.size} literal UI keys checked`
)
if (issues.length) {
  console.error(issues.join("\n"))
  process.exitCode = 1
} else
  console.log(
    "Translation coverage, catalog parity, placeholders, Unicode and machine values passed."
  )
