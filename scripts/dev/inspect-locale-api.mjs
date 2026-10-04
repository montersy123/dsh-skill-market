/**
 * Extract the shape of the DSH `ctx.locale` service from the packaged runtime.
 *
 * The service is what a plugin must call to be bilingual, and guessing its signature would produce
 * code that looks right and does nothing. The asar is a concatenation of module sources, so the
 * declarations are readable as text; this prints the surroundings of each method it finds.
 *
 *   node scripts/inspect-locale-api.mjs [contextChars]
 */
import { readFileSync } from 'node:fs'

const asar = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const context = Number.parseInt(process.argv[2] ?? '700', 10)
const text = readFileSync(asar, 'utf8')

const seen = new Set()
for (const method of ['register', 'bind', 'resolveText', 'addLanguage', 'subscribe']) {
  const needle = `ctx.locale.${method}`
  let from = 0
  let shown = 0
  for (;;) {
    const at = text.indexOf(needle, from)
    if (at < 0 || shown >= 2) break
    from = at + needle.length
    // Print the declaration, not the call site: declarations mention the method without a receiver.
    const slice = text.slice(Math.max(0, at - context), at + context)
    const key = slice.slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    shown += 1
    console.log(`\n${'='.repeat(78)}\n=== ctx.locale.${method}  (offset ${at})\n${'='.repeat(78)}`)
    console.log(slice)
  }
}

// The service's own JS doc, which usually states the contract in one paragraph.
const docAt = text.indexOf('locale service')
if (docAt >= 0) {
  console.log(`\n${'='.repeat(78)}\n=== "locale service" context\n${'='.repeat(78)}`)
  console.log(text.slice(Math.max(0, docAt - 900), docAt + 500))
}
