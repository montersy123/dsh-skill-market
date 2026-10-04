/**
 * Print the Chinese strings that still need translating, excluding the generated locale block.
 *
 * The generated dictionaries are themselves full of Chinese, so counting the file naively reports the
 * dictionary as untranslated work and buries the real remainder. The block's boundaries are its own
 * markers, which is exactly what the inliner writes.
 *
 *   node scripts/i18n-remaining.mjs [area]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Find the Chinese strings in the client that are not translated yet.
 *
 * Exported so the installed-copy check can assert the number is zero, using this one implementation rather
 * than a second, subtly different one: "is the panel fully translated" is exactly the question this
 * answers, and two answers to it would eventually disagree.
 *
 * @returns {{ strings: Array<{value: string, count: number, lines: number[]}>, blockRange: [number, number] }}
 *   The remaining strings and the generated block's line range.
 */
export function findRemainingChinese() {
  const clientPath = join(import.meta.dirname, '..', 'lib', 'client.js')
  const lines = readFileSync(clientPath, 'utf8').split('\n')

  const BEGIN = 'generated locale block'
  const END = 'end generated locale block'
  let beginAt = -1
  let endAt = -1
  for (const [index, line] of lines.entries()) {
    if (beginAt < 0 && line.includes(BEGIN)) { beginAt = index; continue }
    if (beginAt >= 0 && endAt < 0 && line.includes(END)) { endAt = index; break }
  }

  const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/
  const skip = new Set()
  let inBlockComment = false
  for (const [index, line] of lines.entries()) {
    if (index >= beginAt && index <= endAt) { skip.add(index); continue }
    const trimmed = line.trim()
    if (inBlockComment) { skip.add(index); if (trimmed.includes('*/')) inBlockComment = false; continue }
    if (trimmed.startsWith('/*')) { skip.add(index); if (trimmed.includes('*/') === false) inBlockComment = true; continue }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) { skip.add(index); continue }
  }

  const found = new Map()
  for (const [index, line] of lines.entries()) {
    if (skip.has(index)) continue
    const code = line.replace(/\/\/.*$/, '')
    if (CJK.test(code) === false) continue
    for (const match of code.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) {
      const value = match[1] ?? match[2] ?? ''
      if (CJK.test(value) === false) continue
      const entry = found.get(value) ?? { value, count: 0, lines: [] }
      entry.count += 1
      entry.lines.push(index + 1)
      found.set(value, entry)
    }
    for (const match of code.matchAll(/`([^`]*)`/g)) {
      if (CJK.test(match[1]) === false) continue
      const value = match[1]
      const entry = found.get(value) ?? { value, count: 0, lines: [] }
      entry.count += 1
      entry.lines.push(index + 1)
      found.set(value, entry)
    }
  }

  const strings = [...found.values()].sort((a, b) => a.lines[0] - b.lines[0])
  return { strings, blockRange: [beginAt + 1, endAt + 1] }
}

// Only report when run directly, so the check above can import the finder without printing.
if (process.argv[1] !== undefined && process.argv[1].endsWith('i18n-remaining.mjs')) {
  const { strings, blockRange } = findRemainingChinese()
  console.log(`  locale block      : lines ${String(blockRange[0])}-${String(blockRange[1])} (excluded)`)
  console.log(`  remaining strings : ${String(strings.length)}  (${String(strings.reduce((sum, entry) => sum + entry.count, 0))} occurrences)`)
  console.log('')
  for (const entry of strings) {
    const where = `L${String(entry.lines[0])}`
    console.log(`  ${where.padStart(8)}  ${entry.count > 1 ? `${String(entry.count)}x` : '  '}  ${entry.value.slice(0, 96)}`)
  }
  if (strings.length > 0) process.exitCode = 1
}
