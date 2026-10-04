/**
 * List every hardcoded Chinese string in the client, with its line, so a translation can be applied
 * mechanically and reviewed as a diff.
 *
 * Replacing UI text by hand across a 4400-line file is how strings get missed or half-replaced. This
 * emits a JSON catalogue — `{ value, count, lines }` — which is both the input to the rewrite and the
 * source of the dictionary keys, so the two cannot drift apart.
 *
 * Comments are excluded: the file has 1300 lines of Chinese doc comments, and translating the code
 * without touching them is the whole point.
 *
 *   node scripts/i18n-catalogue.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const JSON_OUT = join(import.meta.dirname, 'i18n-catalogue.json')
const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/

/** True when this line index sits inside a comment or a template-literal stylesheet block. */
function buildSkipSet(lines) {
  const skip = new Set()
  let inBlockComment = false
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (inBlockComment) {
      skip.add(index)
      if (trimmed.includes('*/')) inBlockComment = false
      continue
    }
    if (trimmed.startsWith('/*')) {
      skip.add(index)
      if (trimmed.includes('*/') === false) inBlockComment = true
      continue
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) { skip.add(index); continue }
  }
  return skip
}

const file = process.argv[2] && process.argv[2].endsWith('.js')
  ? process.argv[2]
  : join(import.meta.dirname, '..', 'lib', 'client.js')
const source = readFileSync(file, 'utf8')
const lines = source.split('\n')
const skip = buildSkipSet(lines)

const found = new Map()
for (const [index, line] of lines.entries()) {
  if (skip.has(index)) continue
  // Only the part of the line that is actual code: a trailing `// comment` is not the UI's text.
  const code = line.replace(/\/\/.*$/, '')
  for (const match of code.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) {
    const value = match[1] ?? match[2] ?? ''
    if (CJK.test(value) === false) continue
    const entry = found.get(value) ?? { value, count: 0, lines: [] }
    entry.count += 1
    entry.lines.push(index + 1)
    found.set(value, entry)
  }
  // Template literals, which carry interpolation and so need placeholders rather than plain values.
  for (const match of code.matchAll(/`([^`]*)`/g)) {
    const value = match[1]
    if (CJK.test(value) === false) continue
    if (value.includes('${') === false) continue
    const entry = found.get(value) ?? { value, count: 0, lines: [] }
    entry.count += 1
    entry.lines.push(index + 1)
    found.set(value, entry)
  }
}

const catalogue = [...found.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
const literalCount = catalogue.filter((entry) => entry.value.includes('${') === false).length
const templateCount = catalogue.length - literalCount

console.log(`  file            : ${file.split(/[\\/]/).pop()}`)
console.log(`  skipped lines   : ${skip.size} (comments)`)
console.log(`  distinct strings: ${catalogue.length}`)
console.log(`    plain literals: ${literalCount}`)
console.log(`    templates     : ${templateCount}`)
console.log('')
for (const entry of catalogue.filter((item) => item.value.includes('${')).slice(0, 24)) {
  console.log(`  L${String(entry.lines[0]).padStart(4)}  ${entry.value.slice(0, 100)}`)
}

if (process.argv.includes('--write')) {
  writeFileSync(JSON_OUT, `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8')
  console.log(`\n  wrote ${JSON_OUT}`)
}
