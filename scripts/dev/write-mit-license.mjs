/**
 * Write the canonical MIT licence, matching the form the reference repository uses.
 *
 * The MIT text is not typed out: it is the standard body, so it is assembled from one literal and the only
 * variable — the copyright line — is passed in. That keeps a legal document from acquiring a typo, and makes the
 * diff for a future copyright-holder change a one-line edit.
 *
 * The shape was taken from the reference repository rather than invented: title line, a blank line, the copyright
 * line, a blank line, then the permission paragraph. 22 lines, ~1.07 KB, and no appendix describing third-party
 * content — that belongs in the README, where the reference repository also puts it.
 *
 *   node scripts/dev/write-mit-license.mjs "2026 montersy123" [--apply]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const holder = process.argv[2]
const apply = process.argv.includes('--apply')
if (holder === undefined) {
  console.error('  usage: node scripts/dev/write-mit-license.mjs "<year> <name>" [--apply]')
  process.exit(1)
}

const root = join(import.meta.dirname, '..', '..')
const licensePath = join(root, 'LICENSE')

const text = `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

const lines = text.split('\n')
console.log(`  copyright holder : ${holder}`)
console.log(`  bytes            : ${String(Buffer.byteLength(text, 'utf8'))}`)
console.log(`  lines            : ${String(lines.length - 1)}`)
console.log(`  starts with      : ${JSON.stringify(lines[0])}`)
console.log('')

// The essential clauses, asserted so a partial paste cannot pass as the licence.
const REQUIRED = [
  'Permission is hereby granted, free of charge',
  'The above copyright notice and this permission notice shall be included in all',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND',
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
]
for (const clause of REQUIRED) {
  console.log(`  ${text.includes(clause) ? 'ok  ' : 'MISSING'} ${clause.slice(0, 60)}`)
}
console.log('')

if (existsSync(licensePath)) {
  const current = readFileSync(licensePath, 'utf8')
  console.log(`  existing LICENSE: ${current.startsWith('MIT License') ? 'already MIT' : 'will be replaced'}`)
}
if (apply === false) {
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}
writeFileSync(licensePath, text, 'utf8')
console.log('  wrote LICENSE (MIT)')
