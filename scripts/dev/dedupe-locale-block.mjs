/**
 * One-shot: collapse a duplicated generated locale block back to one.
 *
 * Rewriting the path inside the generator's `BEGIN` marker changed the needle without changing the needle in the
 * file, so the generator could not find the existing block and appended a second copy. Two copies declare
 * `CLIENT_NS` twice and the bundle stops parsing.
 *
 * This removes the *second* block verbatim — from the second BEGIN marker through its END marker — leaving the
 * first one for the generator to replace normally. Deliberately minimal: a repair that rewrites the whole file is
 * a repair that can lose the file.
 *
 *   node scripts/dev/dedupe-locale-block.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const clientPath = join(root, 'lib', 'client.js')
const apply = process.argv.includes('--apply')

const source = readFileSync(clientPath, 'utf8')
const BEGIN = '/* ── generated locale block'
const BEGIN_LINE = /[ \t]*\/\* ── generated locale block[^\n]*\n/g
const END_LINE = /[ \t]*\/\* ── end generated locale block[^\n]*\n/g

// Work by line so every removal is a whole line; a partial-line edit inside generated code is how this defect
// appeared in the first place.
const lines = source.split('\n')
const begins = []
const ends = []
for (const [index, line] of lines.entries()) {
  if (line.includes(BEGIN) && line.includes('── */')) begins.push(index)
  if (line.includes('end generated locale block')) ends.push(index)
}

console.log(`  begin marker line(s): ${JSON.stringify(begins.map((index) => index + 1))}`)
console.log(`  end marker line(s)  : ${JSON.stringify(ends.map((index) => index + 1))}`)

if (begins.length <= 1) {
  console.log('')
  console.log('  one block; nothing to collapse')
  process.exit(0)
}

// Remove every block after the first, back to front so earlier indices stay valid.
const removals = []
for (let index = 1; index < begins.length; index += 1) {
  const start = begins[index]
  const end = ends.find((line) => line > start)
  if (end === undefined) {
    console.error(`  FAIL: the block starting at line ${String(start + 1)} has no end marker`)
    process.exit(1)
  }
  removals.push([start, end])
}

let output = [...lines]
for (const [start, end] of removals.reverse()) {
  console.log(`  removing lines ${String(start + 1)}-${String(end + 1)}`)
  output = [...output.slice(0, start), ...output.slice(end + 1)]
}

if (apply === false) {
  console.log('')
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}
writeFileSync(clientPath, output.join('\n'), 'utf8')
console.log('')
console.log(`  collapsed to one block; ${String(output.length)} lines remain`)
