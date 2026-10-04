/**
 * Repair the two error messages in `lib/index.js` that a GBK
 * round-trip mangled and the earlier repair passes missed.
 *
 * The damage is not recoverable by re-encoding — GBK absorbed one byte of a multi-byte
 * character, so the round-trip is lossy — and it is not searchable either, because every
 * damaged character is a legitimate CJK code point with no `?` or U+FFFD to scan for.
 * So the two lines are addressed by a stable ASCII anchor *within each function*: the
 * interpolation text is identical in both, so the enclosing function name disambiguates.
 *
 *   node tools/fix-host-mojibake.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const TARGET = 'lib/index.js'
const apply = process.argv.includes('--apply')

const lines = readFileSync(TARGET, 'utf8').split('\n')

/**
 * Replace the single line matching `anchor` that also sits after `owner`.
 *
 * @param {string} owner - A function name that must precede the line in the file.
 * @param {string} anchor - Unique ASCII substring identifying the line.
 * @param {string} replacement - Full replacement line.
 * @returns {void}
 */
function replaceLine(owner, anchor, replacement) {
  const ownerIndex = lines.findIndex((line) => line.includes(owner))
  if (ownerIndex < 0) throw new Error(`owner not found: ${owner}`)
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => entry.index > ownerIndex && entry.line.includes(anchor))
  // Only the first occurrence after the owner belongs to it; later ones belong to the
  // next function, which is patched by its own call.
  const target = matches[0]
  if (target === undefined) throw new Error(`anchor not found after ${owner}: ${anchor}`)
  const before = lines[target.index]
  lines[target.index] = replacement
  console.log(`line ${String(target.index + 1)} (after ${owner})`)
  console.log(`  - ${before.trim()}`)
  console.log(`  + ${replacement.trim()}`)
}

const TAIL = '${lastError instanceof Error ? lastError.message : String(lastError)}`,'

replaceLine(
  'async function swapIntoPlace',
  'lastError instanceof Error ? lastError.message : String(lastError)',
  `    \`无法替换已存在的技能目录（可能被其它程序占用，请关闭正在使用该目录的程序后重试）：${TAIL}`,
)

replaceLine(
  'async function moveSkillDirectory',
  'lastError instanceof Error ? lastError.message : String(lastError)',
  `    \`无法移动技能目录（可能被其它程序占用，请关闭正在使用该目录的程序后重试）：${TAIL}`,
)

if (!apply) {
  console.log('(dry run; pass --apply to write)')
  process.exit(0)
}
writeFileSync(TARGET, lines.join('\n'), 'utf8')
console.log(`wrote ${TARGET}`)
