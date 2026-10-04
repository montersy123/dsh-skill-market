/**
 * Check that every literal the panel uses as a translation key is defined in both dictionaries.
 *
 * The collection lives in `i18n-keys.mjs` because its first two implementations gave wrong answers — one
 * missed the `tab.*` keys that reached the screen as raw text, the next reported a slot id as a missing key
 * — and a checker whose rule is not itself checked is how that happens. `i18n-keys-check.mjs` validates the
 * rule in both directions; this reports the result for the real bundle.
 *
 *   node scripts/i18n-key-audit.mjs
 */
import { collectKeys, loadSources } from './i18n-keys.mjs'

const { client, ZH, EN } = await loadSources()
const referenced = collectKeys(client)

const missingZh = [...referenced].filter((key) => ZH[key] === undefined).sort()
const missingEn = [...referenced].filter((key) => EN[key] === undefined).sort()

console.log(`  keys referenced by the client : ${String(referenced.size)}`)
console.log(`  keys in the dictionaries      : ${String(Object.keys(ZH).length)}`)
console.log('')

const problems = []
if (missingZh.length > 0) problems.push(`missing from zh (${String(missingZh.length)}): ${missingZh.join(', ')}`)
if (missingEn.length > 0) problems.push(`missing from en (${String(missingEn.length)}): ${missingEn.join(', ')}`)

// Keys defined but never named anywhere in the client are dead weight, and usually mean a call site was
// missed. Matched as a bare substring rather than as a quoted literal, because the panel names keys with
// both quote styles — the generated tables use double quotes, the call sites use single ones.
const unused = Object.keys(ZH).filter((key) => client.includes(key) === false).sort()
console.log(`  defined but never referenced  : ${String(unused.length)}`)
for (const key of unused) console.log(`    ${key}`)

console.log('')
if (problems.length === 0) {
  console.log('EVERY REFERENCED KEY IS DEFINED')
  process.exit(0)
}
for (const problem of problems) console.error('  FAIL ' + problem)
process.exit(1)
