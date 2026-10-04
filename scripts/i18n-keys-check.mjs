/**
 * Prove the key scanner matches what it must and rejects what it must not.
 *
 * A checker that does not catch its target is worse than no checker. The earlier audit missed six `tab.*`
 * keys that reached the screen as raw text, so this asserts the rule against real examples in both
 * directions: keys it must find — including the table case that was missed — and the icon, class, media
 * type and host strings it must not.
 *
 *   node scripts/i18n-keys-check.mjs
 */
import { readFileSync } from 'node:fs'
import { KEY_SHAPE, NOT_KEYS, codeOnly, collectKeys, loadSources } from './i18n-keys.mjs'

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('  the shape rule accepts real keys:')
for (const key of ['tab.overview', 'card.install', 'action.enableRestart', 'misc.vendorKeen', 'risk.low', 'time.days']) {
  expect(KEY_SHAPE.test(key), `accepts ${key}`)
}

console.log('')
console.log('  the shape rule rejects what is not a key:')
for (const value of ['i-arrow-up-circle', 'sm-md-frame', 'sm-tab-icon', 'application/json', 'zh-CN', 'en-US', 'dsh-skill-market/v1', 'officiaL']) {
  expect(KEY_SHAPE.test(value) === false, `rejects ${value}`)
}

console.log('')
console.log('  comment removal keeps strings and drops prose:')
const sample = [
  '/**',
  " * The skill's own record: it doesn't exist for a local import.",
  ' */',
  "const a = t('card.install')",
  "const b = 'i-arrow-up-circle'",
  "// a trailing note with an apostrophe: don't count me",
].join('\n')
const stripped = codeOnly(sample)
expect(stripped.includes("t('card.install')"), 'a call survives comment removal')
expect(stripped.includes('doesn') === false, "an apostrophe in a comment does not leak through")
expect(stripped.includes('skill') === false, 'comment prose is removed')

console.log('')
console.log('  the real bundle:')
const { client, ZH, EN } = await loadSources()
const real = collectKeys(client)
for (const key of ['tab.overview', 'tab.safety', 'tab.metrics', 'risk.low', 'action.enableRestart']) {
  expect(real.has(key), `yields ${key}`)
}
expect(real.has('sidebar.panellist') === false, 'excludes the slot id')
expect(real.has('i-arrow-up-circle') === false, 'excludes an icon name')
const missing = [...real].filter((key) => ZH[key] === undefined || EN[key] === undefined)
expect(missing.length === 0, `every referenced key is defined (${String(real.size)} checked, ${String(missing.length)} missing${missing.length > 0 ? `: ${missing.slice(0, 8).join(', ')}` : ''})`)

// The exclusions must be justified, or an unexplained one could hide a real gap.
expect([...NOT_KEYS].every((value) => value === 'sidebar.panellist' || value === 'api.skillhub.cn'),
  'the exclusion list holds only the two documented entries')

expect(codeOnly(readFileSync('lib/client.js', 'utf8')).includes('const ZH = {') === false,
  'the generated dictionary block is removed before scanning')

console.log('')
console.log(failures === 0 ? 'KEY SCANNER OK' : `${String(failures)} PROBLEM(S)`)
process.exit(failures === 0 ? 0 : 1)
