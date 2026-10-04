/**
 * Read the extracted publish documentation as clean text.
 *
 * The extraction writes whatever the page contained, including NULs and stray control bytes that make the file
 * look binary to a text reader. This strips those and prints the prose, so the publishing requirements can be
 * read rather than guessed at.
 *
 *   node scripts/dev/read-publish-doc.mjs <textFile> [fromLine] [lines]
 */
import { readFileSync } from 'node:fs'

const source = process.argv[2]
const from = Number.parseInt(process.argv[3] ?? '1', 10)
const count = Number.parseInt(process.argv[4] ?? '200', 10)

const raw = readFileSync(source, 'utf8')
// Keep printable text and newlines; drop the control bytes that make the file read as binary.
const clean = raw
  .replace(/\u0000/g, '')
  .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .split('\n')
  .map((line) => line.trimEnd())
  .filter((line, index, all) => line !== '' || (all[index - 1] ?? '') !== '')

console.log(`  ${String(clean.length)} cleaned lines; showing ${String(from)}-${String(from + count - 1)}`)
console.log('')
for (const line of clean.slice(from - 1, from - 1 + count)) console.log(line)
