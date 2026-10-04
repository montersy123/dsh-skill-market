/**
 * Read a SKILL.md as UTF-8 and report whether its bytes are valid UTF-8.
 *
 * The panel's own installs are written from HTTP bodies, so they are valid UTF-8 by construction. A
 * file that is not was put there by something else, which matters: it means the install record's
 * "1.0.0" is not this bundle's version, and the directory name may not encode a real catalogue entry.
 *
 *   node scripts/skill-file-probe.mjs <directoryName>
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const directoryName = process.argv[2] ?? 'clawhub-root--find-skills'
const skillRoot = join(process.env.DSH_HOME ?? '', 'skills')
const path = join(skillRoot, directoryName, 'SKILL.md')

const bytes = readFileSync(path)
console.log(`  file : ${path}`)
console.log(`  bytes: ${bytes.length}`)

// `toString('utf8')` never throws: invalid sequences become U+FFFD. Round-tripping is what detects it.
const text = bytes.toString('utf8')
const roundTrip = Buffer.from(text, 'utf8').equals(bytes)
const replacementCount = (text.match(/\uFFFD/g) ?? []).length
console.log(`  valid UTF-8: ${roundTrip}${replacementCount === 0 ? '' : ` (${replacementCount} replacement chars)`}`)

// Mojibake is bytes decoded as the wrong encoding and re-encoded. Reversing UTF-8 -> latin1 -> UTF-8
// recovers the original when that is what happened.
if (roundTrip === false) {
  const recovered = Buffer.from(text, 'latin1').toString('utf8')
  console.log(`  recovered as latin1->utf8: ${JSON.stringify(recovered.slice(0, 120))}`)
}

console.log('')
console.log('  --- first 600 characters, as UTF-8 ---')
console.log(text.slice(0, 600).split('\n').map((line) => '  ' + line).join('\n'))
