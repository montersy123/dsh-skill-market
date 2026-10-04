/**
 * Finish the rename to `@montersy123/dsh-skill-market`, for the strings that identify
 * the plugin to other systems.
 *
 * Only remote-facing identity is rewritten — the upstream `User-Agent` and the effect
 * labels that carry the package name. Storage keys and the panel's locale namespace are
 * deliberately left alone: they are on-disk identities, so renaming them would drop a
 * user's saved favorites and ledger.
 *
 *   node tools/rename-plugin.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SCOPED = '@montersy123/dsh-skill-market'
const apply = process.argv.includes('--apply')

/** File -> [from, to] pairs. Each must occur at least once. */
const EDITS = [
  ['lib/index.js', [
    ["'user-agent': 'dsh-skill-market/", `'user-agent': '${SCOPED}/`],
    ["'dsh-skill-market: routes'", `'${SCOPED}: routes'`],
    ["'dsh-skill-market: withdraw live skills'", `'${SCOPED}: withdraw live skills'`],
  ]],
  ['lib/client.js', [
    ["'dsh-skill-market: stylesheet'", `'${SCOPED}: stylesheet'`],
  ]],
]

for (const [file, pairs] of EDITS) {
  const path = `${file}`
  let text = readFileSync(path, 'utf8')
  for (const [from, to] of pairs) {
    const count = text.split(from).length - 1
    console.log(`${file}: ${count}x ${JSON.stringify(from)}`)
    if (count === 0) throw new Error(`no occurrence of ${JSON.stringify(from)} in ${file}`)
    text = text.split(from).join(to)
  }
  if (apply) writeFileSync(path, text, 'utf8')
}
console.log(apply ? 'written' : '(dry run; pass --apply)')
