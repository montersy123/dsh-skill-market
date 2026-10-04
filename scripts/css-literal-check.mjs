/**
 * Guard the stylesheet against a template-literal hazard that is invisible in a diff.
 *
 * The whole stylesheet is one template literal, so a single backtick inside a CSS comment closes the
 * string early and the file becomes a syntax error far from the line that caused it. This happened
 * twice in one edit while writing comments that named a class. Checking is cheap; spotting it by eye
 * is not.
 *
 *   node scripts/css-literal-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
)

const failures = []
const marker = /(?:const|let)\s+CSS\s*=\s*`/
const found = marker.exec(source)
if (found === null) {
  failures.push('could not locate the stylesheet template literal')
} else {
  const start = found.index + found[0].length
  // The literal ends at the first unescaped backtick after its start.
  let index = start
  let closed = -1
  while (index < source.length) {
    if (source[index] === '\\') { index += 2; continue }
    if (source[index] === '`') { closed = index; break }
    index += 1
  }
  if (closed < 0) {
    failures.push('the stylesheet literal is never closed')
  } else {
    const body = source.slice(start, closed)
    const interpolations = [...body.matchAll(/\$\{/g)].length
    console.log(`  stylesheet body : ${String(body.length)} chars`)
    console.log(`  closes at       : offset ${String(closed)}`)
    console.log(`  interpolations  : ${String(interpolations)}`)

    // The assertions below are deliberately about what must NOT be in the body, because the extraction itself
    // cannot be trusted to end at the right place: the stylesheet contains escaped backticks of its own (in
    // comments that quote a declaration), so "the first unescaped backtick after the declaration" can land
    // mid-stylesheet. A length or brace-count threshold was tried and produced false answers in both
    // directions — it passed while the literal was truncated, and once reported a healthy 45 000-character
    // stylesheet as "3 rules". JavaScript keywords have no legitimate place in a stylesheet, so their presence
    // is a reliable signal that the literal closed early, whatever offset the scan picked.
    if (body.includes('`') === true) failures.push('a backtick remains inside the stylesheet body')
    if (body.includes('{') === false || body.includes('}') === false) {
      failures.push('the stylesheet body does not look like CSS')
    }
    for (const token of ['function ', 'const ', '=> ', 'return ', 'useState']) {
      if (body.includes(token)) failures.push(`the stylesheet body contains JavaScript (${JSON.stringify(token)}), so the literal closed early`)
    }
    console.log(`  closing braces  : ${String((body.match(/\}/g) ?? []).length)}`)
  }
}

// And of course the file has to parse at all, which is the symptom this guards.
console.log('')
if (failures.length === 0) {
  console.log('CSS LITERAL OK')
  process.exit(0)
}
for (const failure of failures) console.error('  FAIL ' + failure)
process.exit(1)
