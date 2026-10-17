/**
 * Run the namespace repair against the live install record, and report what changed.
 *
 * The installed skills sit in directories named `user-814dbe54--github` while upstream publishes them
 * under `user_814dbe54`, so every detail request 404s. This shows the repair working on the real record
 * — and, importantly, that it repairs rather than guesses.
 *
 *   node --import ./scripts/asar-resolver.mjs scripts/repair-identity.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const recordPath = join(
  process.env.DSH_HOME ?? '',
  'storages',
  '@montersy123',
  'dsh-skill-market',
  'data',
  'installed.json',
)

const read = () => JSON.parse(readFileSync(recordPath, 'utf8'))

console.log('  record:', recordPath)
console.log('  before:', JSON.stringify(read()))
console.log('')

const mod = await import('@montersy123/dsh-skill-market')
const outcome = await mod.repairInstallIdentityForTest()

console.log('  repaired  :', outcome.repaired.join(' | ') || '(none)')
console.log('  unresolved:', outcome.unresolved.join(' | ') || '(none)')
console.log('  after     :', JSON.stringify(read()))
console.log('')

// The proof that matters: the identifiers the panel will now use must resolve upstream.
const summary = await mod.registryForTest({
  skills: { register: () => () => {} },
  logger: { warn() {}, debug() {} },
}).summary()
for (const row of summary.skills) {
  const url = `https://api.skillhub.cn/api/v1/skills/${encodeURIComponent(row.slug)}?namespace=${encodeURIComponent(row.handle)}`
  const response = await fetch(url)
  console.log(`  ${row.directoryName}`)
  console.log(`    panel will ask: namespace=${row.handle} slug=${row.slug} -> HTTP ${response.status}`)
}
