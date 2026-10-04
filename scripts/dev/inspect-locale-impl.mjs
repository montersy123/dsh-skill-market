/**
 * Find the locale service's implementation in the packaged runtime and print its method bodies.
 *
 * The host-side docs describe `register`/`bind`, but the client half is what the panel calls, and its
 * exact signature decides whether the panel binds once at registration or inside every render. A wrong
 * guess here fails only after a restart, so the implementation is read rather than assumed.
 *
 *   node scripts/inspect-locale-impl.mjs [method] [chars]
 */
import { readFileSync } from 'node:fs'

const method = process.argv[2] ?? 'register'
const chars = Number.parseInt(process.argv[3] ?? '1400', 10)
const asar = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const text = readFileSync(asar, 'utf8')

const patterns = [
  new RegExp(`\\n\\s*${method}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
  new RegExp(`\\n\\s*async\\s+${method}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
  new RegExp(`\\n\\s*${method}\\s*:\\s*(?:async\\s*)?function`, 'g'),
]

let shown = 0
for (const pattern of patterns) {
  for (const match of text.matchAll(pattern)) {
    const at = match.index
    const slice = text.slice(at, at + chars)
    // Only interesting where the body mentions locales; the runtime has many unrelated `register`s.
    if (/zh|locale|dictionary|namespace|fallback/i.test(slice) === false) continue
    console.log(`\n${'='.repeat(80)}\n=== /${pattern.source}/  at offset ${at}\n${'='.repeat(80)}`)
    console.log(slice)
    shown += 1
    if (shown >= 4) break
  }
  if (shown >= 4) break
}
if (shown === 0) console.log(`  no implementation found for "${method}"`)
