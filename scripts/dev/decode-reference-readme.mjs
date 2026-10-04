/**
 * Decode the reference README so its attribution section can be read.
 *
 * The GitHub contents API returns file bodies base64-encoded, and this one is 4.3 KB of Chinese — reading it
 * through a console that mangles UTF-8 is how a wrong conclusion gets drawn. Decoding to a file and printing
 * it here keeps the bytes honest.
 *
 *   node scripts/dev/decode-reference-readme.mjs <base64File> [outFile]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2]
const out = process.argv[3] ?? 'reference-readme.md'
if (source === undefined) {
  console.error('  usage: node scripts/dev/decode-reference-readme.mjs <base64File> [outFile]')
  process.exit(1)
}

// The API wraps the payload in JSON; accept either the raw JSON or a bare base64 string.
const raw = readFileSync(source, 'utf8').trim()
let base64 = raw
if (raw.startsWith('{')) {
  base64 = JSON.parse(raw).content ?? ''
}
const text = Buffer.from(base64.replace(/\s+/g, ''), 'base64').toString('utf8')
writeFileSync(out, text, 'utf8')
console.log(`  decoded ${String(Buffer.byteLength(text, 'utf8'))} bytes to ${out}`)
console.log('')
for (const line of text.split('\n')) console.log(line)
