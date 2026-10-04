/**
 * Print the plain (non-template) strings from the i18n catalogue, one per line with its occurrences.
 *
 * Reading the catalogue is how the dictionary keys get chosen, so this is a deliberately plain
 * listing. Written as a file because the escaping in an inline Node one-liner through PowerShell is
 * unreliable enough to produce wrong output.
 *
 *   node scripts/i18n-list.mjs [plain|template|all]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const what = process.argv[2] ?? 'plain'
const catalogue = JSON.parse(readFileSync(join(import.meta.dirname, 'i18n-catalogue.json'), 'utf8'))

const selected = catalogue.filter((entry) => {
  const isTemplate = entry.value.includes('${')
  if (what === 'plain') return isTemplate === false
  if (what === 'template') return isTemplate
  return true
})

const width = String(selected.length).length
for (const [index, entry] of selected.entries()) {
  const count = entry.count > 1 ? `${entry.count}x` : '  '
  console.log(`${String(index + 1).padStart(width)}  ${count}  ${entry.value}`)
}
console.log(`\n  ${selected.length} ${what} string(s)`)
