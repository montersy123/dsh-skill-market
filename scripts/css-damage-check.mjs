/**
 * Check the client's stylesheet for damage from the translation batches.
 *
 * The batch replacements ran over the whole file, and the CSS is one large template literal in the same
 * file. A replacement that landed inside it would change a layout rule, which is exactly how a page ends
 * up misaligned while every syntax and structure check still passes.
 *
 *   node scripts/css-damage-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const path = join(import.meta.dirname, '..', 'lib', 'client.js')
const source = readFileSync(path, 'utf8')
const lines = source.split('\n')

const BACKTICK = String.fromCharCode(96)
// Locate the literal by the marker itself, the same way `css-literal-check.mjs` does: `indexOf` on the
// declaration plus the marker length is an offset into the source string, and computing it from a re-joined
// slice of lines got the arithmetic wrong.
const marker = /(?:const|let)\s+CSS\s*=\s*`/
const found = marker.exec(source)
if (found === null) {
  console.error('  FAIL: the CSS declaration was not found')
  process.exit(1)
}
const startOffset = found.index + found[0].length
const start = source.slice(0, found.index).split('\n').length
// The literal ends at the first unescaped backtick *anywhere*, not at the first line that is only a backtick.
// The earlier version searched for a lone-backtick line, so a backtick introduced inside a CSS comment — the
// exact defect this file exists to catch — was skipped and the scan continued to the real terminator, finding
// a healthy block while the literal was in fact truncated.
let endOffset = -1
for (let index = startOffset; index < source.length; index += 1) {
  if (source[index] === '\\') { index += 1; continue }
  if (source[index] === BACKTICK) { endOffset = index; break }
}
if (endOffset < 0) {
  console.error('  FAIL: the CSS template literal is not closed')
  process.exit(1)
}
const css = source.slice(startOffset, endOffset)
const endLine = source.slice(0, endOffset).split('\n').length

console.log(`  CSS block        : lines ${String(start + 1)}-${String(endLine)} (${String(endLine - start)} lines)`)
console.log(`  CSS characters   : ${String(css.length)}`)

const problems = []

// 1. No translator call may appear inside the stylesheet.
const translatorCalls = [...css.matchAll(/\bt\(\s*['"]/g)]
if (translatorCalls.length > 0) {
  problems.push(`${String(translatorCalls.length)} translator call(s) inside the CSS: ${translatorCalls.slice(0, 4).map((m) => m[0]).join(' ')}`)
}

// 2. The template literal must contain no unescaped backtick and no `${` interpolation, or the stylesheet
//    would be evaluated as code rather than shipped as text.
const interpolations = [...css.matchAll(/\$\{/g)]
if (interpolations.length > 0) problems.push(`${String(interpolations.length)} \`\${...}\` interpolation(s) inside the CSS`)

// 3. Brace balance, counting only outside CSS comments. A comment that mentions a declaration — such as the
//    one explaining `max-height: 100%` — contains braces that are not rules, and counting them reported a
//    healthy stylesheet as unbalanced.
let depth = 0
let inComment = false
let quote = null
for (let index = 0; index < css.length; index += 1) {
  const character = css[index]
  const next = css[index + 1]
  if (inComment) {
    if (character === '*' && next === '/') { inComment = false; index += 1 }
    continue
  }
  if (quote !== null) { if (character === quote) quote = null; continue }
  if (character === '/' && next === '*') { inComment = true; index += 1; continue }
  if (character === "'" || character === '"') { quote = character; continue }
  if (character === '{') depth += 1
  else if (character === '}') depth -= 1
}
console.log(`  brace balance    : ${String(depth)} (0 = balanced, comments excluded)`)
if (depth !== 0) problems.push(`the stylesheet is unbalanced by ${String(depth)} brace(s)`)

// 4. The layout rules the panel depends on must still be present. These are the selectors the render
//    harness asserts structurally, so a lost rule shows here and as misalignment in the browser.
const required = [
  '.sm-grid-cards', '.sm-card', '.sm-fixed', '.sm-content', '.sm-viewbar', '.sm-viewtab',
  '.sm-inspector', '.sm-insp-head', '.sm-insp-body', '.sm-tabs', '.sm-list', '.sm-list-row',
  '.sm-topbar', '.sm-search', '.sm-chips', '.sm-chip', '.sm-statusbar', '.sm-dropzone',
  '.sm-stat-strip', '.sm-loadmore', '.sm-badge', '.sm-btn',
]
const missing = required.filter((selector) => css.includes(selector) === false)
if (missing.length > 0) problems.push(`stylesheet rule(s) missing: ${missing.join(', ')}`)
console.log(`  required selectors: ${String(required.length - missing.length)}/${String(required.length)} present`)

// 5. Grid track definition: the responsive column rule is what makes cards fill the row.
const grid = css.match(/\.sm-grid-cards\s*\{[^}]*\}/s)
if (grid === null) problems.push('the .sm-grid-cards rule body was not found')
else console.log(`  grid rule        : ${grid[0].replace(/\s+/g, ' ').slice(0, 110)}`)

console.log('')
if (problems.length === 0) {
  console.log('CSS CONTENT OK')
  process.exit(0)
}
for (const problem of problems) console.error('  FAIL ' + problem)
process.exit(1)
