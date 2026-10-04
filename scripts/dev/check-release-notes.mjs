/**
 * Validate a release-notes file before it is published.
 *
 * The notes are a public document, and the ways they go wrong are quiet: a mojibake character from a console that
 * mangled UTF-8, a truncated paste, an unbalanced code fence that swallows the rest of the page. This checks the
 * bytes rather than trusting the terminal.
 *
 *   node scripts/dev/check-release-notes.mjs <file>
 */
import { readFileSync, statSync } from 'node:fs'

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
const headings = lines.filter((line) => /^#{2,3} /.test(line))

const checks = [
  ['valid UTF-8 with no replacement characters', text.includes('\uFFFD') === false, `U+FFFD count: ${String((text.match(/\uFFFD/g) ?? []).length)}`],
  ['contains Chinese text', cjk > 200, `${String(cjk)} CJK characters`],
  ['contains an English section', text.includes('## English'), ''],
  ['code fences are balanced', fences % 2 === 0, `${String(fences)} fences`],
  ['has a reasonable size', bytes.length > 2000, `${String(bytes.length)} bytes`],
  ['does not begin or end with whitespace-only line', lines[0].trim() !== '' && lines[lines.length - 1] === '', ''],
]

for (const [label, ok, detail] of checks) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail === '' ? '' : `   [${detail}]`}`)
}
console.log('')
console.log(`  headings: ${headings.map((line) => line.trim()).join(' | ')}`)
console.log('')
const failed = checks.filter(([, ok]) => ok === false).length
console.log(`  ${String(checks.length - failed)}/${String(checks.length)} passed`)
process.exit(failed === 0 ? 0 : 1)
