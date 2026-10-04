/**
 * Validate a catalog entry against the rules the registry's checker enforces.
 *
 * The registry validates with js-yaml and a fixed key set, so parsing with the same library locally is the only way
 * to know the entry passes before the PR is opened. The rules below are transcribed from `scripts/lib/entries.mjs`
 * in awesome-dsh-plugin/awesome-dsh-plugin, which is the code CI actually runs.
 *
 *   node check-entry.mjs <entry.yml> <entries.mjs>
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const [entryPath, entriesSource] = process.argv.slice(2)
if (entryPath === undefined) {
  console.error('  usage: node check-entry.mjs <entry.yml> [entriesSource.mjs]')
  process.exit(1)
}

// js-yaml lives in the scratch install, not in this project, so resolve it from there.
const require = createRequire(process.env.YAML_SCRATCH ?? process.cwd() + '/')
const { load } = require('js-yaml')

const problems = []
let entry
try {
  entry = load(readFileSync(entryPath, 'utf8'))
} catch (error) {
  console.error(`  FAIL: invalid YAML — ${error.reason ?? error.message}`)
  process.exit(1)
}

// The registry's own lists, read from its source so this cannot drift from it.
const catMatch = readFileSync(entriesSource, 'utf8').match(/CAT_IDS = \[[^\]]*\]/)
const categories = catMatch[0]
  .replace('CAT_IDS = ', '')
  .replace(/[[\]']/g, '')
  .split(',')
  .map((value) => value.trim())
const LOCALES = ['en', 'zh']
const KEYS = new Set(['url', 'name', 'category', 'description', 'tarball', 'file'])

for (const key of Object.keys(entry)) {
  if (KEYS.has(key) === false) problems.push(`unknown key "${key}"`)
}
if (typeof entry.url !== 'string' || /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(entry.url) === false) {
  problems.push(`"url" must be an exact https://github.com/owner/repo (got ${JSON.stringify(entry.url)})`)
}
if (typeof entry.name !== 'string' || entry.name.trim() === '') problems.push('"name" is required')
if (categories.includes(entry.category) === false) {
  problems.push(`"category" must be one of ${categories.join(', ')} (got ${JSON.stringify(entry.category)})`)
}
for (const locale of LOCALES) {
  const text = entry.description?.[locale]
  if (text === undefined) {
    if (locale === 'en') problems.push('"description.en" is required')
    continue
  }
  if (typeof text !== 'string') problems.push(`"description.${locale}" must be a string`)
  else if (text.trim() === '') problems.push(`"description.${locale}" is present but empty — omit the key instead`)
  else if (text.includes('\n')) problems.push(`"description.${locale}" must be a single line`)
}

console.log(`  parsed     : ${entryPath}`)
console.log(`  url        : ${entry.url}`)
console.log(`  category   : ${entry.category}  (valid: ${categories.includes(entry.category)})`)
for (const locale of LOCALES) {
  const text = entry.description?.[locale]
  console.log(`  desc.${locale}  : ${text === undefined ? '(absent)' : `${String(text.length)} chars, ends with period: ${/[.。]$/.test(text)}`}`)
}
console.log('')

if (problems.length === 0) {
  console.log('  ENTRY VALID — no problems found')
  process.exit(0)
}
console.log(`  ${String(problems.length)} problem(s):`)
for (const problem of problems) console.log(`    - ${problem}`)
process.exit(1)
