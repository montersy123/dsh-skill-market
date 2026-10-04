/**
 * Validate a release-notes file before it is published.
 *
 * The notes are a public document, and the ways they go wrong are quiet: a mojibake character from a console that
 * mangled UTF-8, a truncated paste, an unbalanced code fence that swallows the rest of the page. This checks the
 * bytes, and reports the shape rather than scoring it.
 *
 * Bilingual length is deliberately not a pass/fail rule. A release whose notes are one short paragraph — a version
 * that only moved documentation — is a legitimate release, and a checker that failed it would be pushing authors to
 * pad a page for the checker's benefit.
 *
 *   node scripts/dev/check-release-notes.mjs <file>
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (path === undefined) {
  console.error('  usage: node scripts/dev/check-release-notes.mjs <file>')
  process.exit(1)
}

const bytes = readFileSync(path)
const text = bytes.toString('utf8')
const lines = text.split('\n')

const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
const fences = (text.match(/^```/gm) ?? []).length
const headings = lines.filter((line) => /^#{1,3} /.test(line))
const hasEnglish = text.includes('## English')

// These are the failures that make the page wrong rather than merely short.
const checks = [
  ['valid UTF-8 with no replacement characters', text.includes('\uFFFD') === false, `U+FFFD count: ${String((text.match(/\uFFFD/g) ?? []).length)}`],
  ['code fences are balanced', fences % 2 === 0, `${String(fences)} fences`],
  ['has at least one heading', headings.length > 0, `${String(headings.length)} headings`],
  ['is not empty', bytes.length > 200, `${String(bytes.length)} bytes`],
  ['does not start with a blank line', lines[0].trim() !== '', ''],
]

console.log(`  file       : ${path}`)
console.log(`  size       : ${String(bytes.length)} bytes, ${String(lines.length)} lines`)
console.log(`  CJK chars  : ${String(cjk)}`)
console.log(`  bilingual  : ${hasEnglish ? 'yes — has an English section' : 'no — single language'}`)
console.log(`  headings   : ${headings.map((line) => line.trim()).join(' | ')}`)
console.log('')

for (const [label, ok, detail] of checks) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail === '' ? '' : `   [${detail}]`}`)
}

const failed = checks.filter(([, ok]) => ok === false)
console.log('')
console.log(`  ${String(checks.length - failed.length)}/${String(checks.length)} structural checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
