/**
 * Find how the client module loader resolves a `require()` inside a plugin bundle.
 *
 * Whether the panel can `require('./locale.js')` decides where the dictionaries live: a separate file
 * is cleaner but only works if the loader's `edges` mechanism actually exposes it. Getting this wrong
 * fails at page mount, after a restart.
 *
 *   node scripts/inspect-make-require.mjs
 */
import { readFileSync } from 'node:fs'

const asar = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const text = readFileSync(asar, 'utf8')

for (const needle of ['makeRequire(', 'makeRequire =', 'edges', '__ModuleLoader__']) {
  let from = 0
  let shown = 0
  for (;;) {
    const at = text.indexOf(needle, from)
    if (at < 0 || shown >= 2) break
    from = at + needle.length
    const slice = text.slice(Math.max(0, at - 700), at + 900)
    // Only where the loader is involved.
    if (/moduleloader|makeRequire|external|specifier/i.test(slice) === false) continue
    shown += 1
    console.log(`\n${'='.repeat(78)}\n=== "${needle}" at ${at}\n${'='.repeat(78)}`)
    console.log(slice)
  }
}
