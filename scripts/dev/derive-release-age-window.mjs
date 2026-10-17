/**
 * Work out when a lockfile entry stops violating pnpm's minimum release age policy.
 *
 * The plugin manager's log gives the cutoff it computed and the publish time of the entry it rejected, so the
 * policy's window can be derived instead of guessed, and the moment the entry ages out can be stated exactly. That
 * matters because the remedy is to wait, and "wait" is only useful advice with a time attached.
 *
 *   node scripts/dev/derive-release-age-window.mjs
 */
const published = new Date('2026-10-04T03:29:44.615Z')
const cutoff = new Date('2026-10-03T23:07:52.901Z')
const now = new Date()

const windowMs = now.getTime() - cutoff.getTime()
console.log(`  entry published : ${published.toISOString()}`)
console.log(`  cutoff from log : ${cutoff.toISOString()}`)
console.log(`  derived window  : ${(windowMs / 3_600_000).toFixed(1)} h  (the cutoff is "now minus the window")`)
console.log('')

const eligibleAt = new Date(published.getTime() + windowMs)
console.log(`  now             : ${now.toISOString()}`)
console.log(`  entry is        : ${((now.getTime() - published.getTime()) / 3_600_000).toFixed(1)} h old`)
console.log(`  eligible at     : ${eligibleAt.toISOString()}`)
console.log(`  in              : ${((eligibleAt.getTime() - now.getTime()) / 3_600_000).toFixed(1)} h`)
console.log('')
console.log('  The profile spells this exclusion out, which the lockfile policy check does not consult:')
console.log('    minimumReleaseAgeExclude:')
console.log('      - dsh-context@0.63.0')
