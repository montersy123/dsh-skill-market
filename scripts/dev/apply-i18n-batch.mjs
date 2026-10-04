/**
 * Apply one batch of translation replacements to the client bundle.
 *
 * Replacing UI text by hand across a 4400-line file is how strings are half-replaced, and several
 * Chinese fragments in it are substrings of others (`'已安装'` inside `'已安装的技能；…'`), so a naive
 * search would corrupt unrelated text. Each entry here is therefore an exact source span, applied
 * once, and the script refuses to run if any entry matches zero or more than its expected count —
 * a silent no-op is the failure mode worth designing out.
 *
 *   node scripts/apply-i18n-batch.mjs <batch.mjs>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const batchPath = process.argv[2]
if (batchPath === undefined) {
  console.error('  usage: node scripts/apply-i18n-batch.mjs <batch.mjs>')
  process.exit(1)
}

const { default: batch } = await import(`file://${join(process.cwd(), batchPath).replace(/\\/g, '/')}`)
const clientPath = join(import.meta.dirname, '..', 'lib', 'client.js')
let source = readFileSync(clientPath, 'utf8')

const problems = []
let applied = 0
for (const [from, to, expected = 1] of batch) {
  const count = source.split(from).length - 1
  if (count !== expected) {
    problems.push(`expected ${expected} match(es), found ${count}: ${JSON.stringify(from.slice(0, 70))}`)
    continue
  }
  source = source.split(from).join(to)
  applied += 1
}

console.log(`  ${applied}/${batch.length} replacement(s) applied`)
if (problems.length > 0) {
  console.log('')
  for (const problem of problems) console.log('  SKIPPED ' + problem)
  console.log(`\n  nothing written; fix the ${problems.length} mismatch(es) and re-run`)
  process.exit(1)
}

writeFileSync(clientPath, source, 'utf8')
console.log('  written')
