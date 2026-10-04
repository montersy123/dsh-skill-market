/**
 * One-shot: replace the MIT license with the canonical Apache License 2.0.
 *
 * The text is downloaded from apache.org rather than transcribed: it is a legal document, and a transcription
 * error in a licence is worse than a transcription error anywhere else. The download's SHA-256 is asserted
 * against the digest of the official file, and only the appendix's `[yyyy] [name of copyright owner]`
 * placeholder is filled in — everything else is left byte-for-byte as published.
 *
 *   node scripts/dev/switch-to-apache.mjs [--apply]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const apply = process.argv.includes('--apply')

// The digest of https://www.apache.org/licenses/LICENSE-2.0.txt. Asserting it means a truncated or rewritten
// download cannot silently become the project's licence.
const EXPECTED_SHA256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
const EXPECTED_BYTES = 11358
const URL = 'https://www.apache.org/licenses/LICENSE-2.0.txt'

const response = await fetch(URL)
if (response.ok === false) throw new Error(`could not download the licence: HTTP ${String(response.status)}`)
const downloaded = Buffer.from(await response.arrayBuffer())

const sha256 = createHash('sha256').update(downloaded).digest('hex')
console.log(`  downloaded      : ${String(downloaded.length)} bytes from ${URL}`)
console.log(`  sha256          : ${sha256}`)
console.log(`  matches official: ${String(sha256 === EXPECTED_SHA256 && downloaded.length === EXPECTED_BYTES)}`)
if (sha256 !== EXPECTED_SHA256 || downloaded.length !== EXPECTED_BYTES) {
  console.error('  FAIL: the download does not match the official Apache License 2.0; refusing to write it')
  process.exit(1)
}

let text = downloaded.toString('utf8')

// Fill only the appendix placeholder, the way the ecosystem's other plugins do. `[yyyy]` and the owner name are
// the two fields Apache's own instructions say to complete.
const placeholder = 'Copyright [yyyy] [name of copyright owner]'
if (text.includes(placeholder) === false) {
  console.error('  FAIL: the appendix placeholder was not found; the licence text may have changed')
  process.exit(1)
}
const filled = 'Copyright 2026 montersy123'
text = text.replace(placeholder, filled)
console.log(`  appendix        : "${placeholder}" -> "${filled}"`)
console.log(`  resulting size  : ${String(Buffer.byteLength(text, 'utf8'))} bytes`)

const licensePath = join(root, 'LICENSE')
console.log('')
console.log(`  existing LICENSE: ${existsSync(licensePath) ? 'present (will be replaced)' : 'absent'}`)
if (apply === false) {
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}

// A copy is kept beside the new one so the change is inspectable in the working tree rather than only in git.
if (existsSync(licensePath)) {
  writeFileSync(`${licensePath}.MIT.bak`, readFileSync(licensePath))
  console.log('  the previous licence was saved as LICENSE.MIT.bak')
}
writeFileSync(licensePath, text, 'utf8')
console.log('  wrote LICENSE (Apache License 2.0)')
