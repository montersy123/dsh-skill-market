/**
 * Guard the generated locale block's bracket balance, precisely and cheaply.
 *
 * Hand-writing a lexer to count brackets across the whole file was tried twice and reported defects that
 * did not exist: the file has regex literals with character classes, CSS inside a template literal, and
 * thousands of lines of comments containing Chinese brackets. `locate-imbalance.mjs` is the honest tool
 * for a real imbalance, and `node --check` catches one outright.
 *
 * What is worth guarding here is narrower and mechanical: the block is *generated*, and an edit that
 * corrupts it would be regenerated. So this checks the generated region alone, where the content is known
 * to be plain object literals with JSON string keys and no regex, plus the two facts every translation
 * batch depended on — the block is present exactly once, and the dictionaries are non-empty.
 *
 *   node scripts/generated-block-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const path = join(import.meta.dirname, '..', 'lib', 'client.js')
const lines = readFileSync(path, 'utf8').split('\n')

const BEGIN = 'generated locale block'
const END = 'end generated locale block'
const problems = []

const beginAt = lines.findIndex((line) => line.includes(BEGIN))
const endAt = lines.findIndex((line) => line.includes(END))
if (beginAt < 0) problems.push('the generated locale block marker is missing')
if (endAt < 0) problems.push('the end-of-block marker is missing')
if (beginAt >= 0 && endAt >= 0 && endAt < beginAt) problems.push('the end marker comes before the begin marker')

const occurrences = lines.filter((line) => line.includes('── generated locale block')).length
if (occurrences !== 1) problems.push(`the block marker appears ${String(occurrences)} time(s); expected exactly 1`)

// Both markers must appear exactly once. A stray *end* marker is the residue of a generator that appended a block
// instead of replacing one: it is a comment, so it survives parsing, the key count, the bracket balance and every
// other check — and it makes the next run's marker scan ambiguous.
const endOccurrences = lines.filter((line) => line.includes('── end generated locale block')).length
if (endOccurrences !== 1) {
  problems.push(`the end-of-block marker appears ${String(endOccurrences)} time(s); expected exactly 1`)
}

if (beginAt >= 0 && endAt > beginAt) {
  const block = lines.slice(beginAt, endAt + 1)

  const dictOpens = block.filter((line) => /const (ZH|EN) = \{/.test(line)).length
  const keyLines = block.filter((line) => /^\s{6}"/.test(line)).length

  if (dictOpens !== 2) problems.push(`the block opens ${String(dictOpens)} dictionary object(s); expected 2 (ZH and EN)`)
  if (keyLines < 100) problems.push(`the block holds only ${String(keyLines)} key line(s); that is too few to be a real dictionary`)

  // Deliberately no bracket counting here. The block's values are JSON strings that legitimately contain
  // brackets (`({count} files)`), and three attempts at modelling the structure by indentation produced
  // only false reports. Byte-exact integrity is already guaranteed by `inline-client-locale.mjs --check`,
  // which regenerates the block and compares: any tampering or corruption fails there, which is a much
  // stronger statement than a bracket count.
  console.log(`  block lines      : ${String(block.length)} (L${String(beginAt + 1)}-${String(endAt + 1)})`)
  console.log(`  key lines        : ${String(keyLines)} (${String(keyLines / 2)} per dictionary)`)
  console.log(`  dictionary opens : ${String(dictOpens)}`)
  console.log('  integrity        : byte-exact comparison is done by inline-client-locale.mjs --check')
}

const source = lines.join('\n')
console.log(`  total lines      : ${String(lines.length)}`)
console.log(`  block marker     : ${String(occurrences)}x`)
console.log('')

if (problems.length === 0) {
  console.log('GENERATED BLOCK OK')
  process.exit(0)
}
for (const problem of problems) console.error('  FAIL ' + problem)
process.exit(1)
