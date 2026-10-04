/**
 * Point the README's verification commands and title at the scoped package name.
 *
 * Only the command lines and the boot-audit expectation are rewritten; the passages that
 * deliberately keep the unscoped spelling (the `localStorage` keys) are left alone.
 *
 *   node tools/rename-readme.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const TARGET = 'README.md'
const apply = process.argv.includes('--apply')

/** Whole-line replacements: from -> to, matched after trimming. */
const LINES = [
  ['# dsh-skill-market · Harness 技能市场', '# @montersy123/dsh-skill-market · Harness 技能市场'],
  ['node scripts/boot-client-check.mjs dsh-skill-market', 'node scripts/boot-client-check.mjs @montersy123/dsh-skill-market'],
  ['# 期望：ok dsh-skill-market: inject=["slots"] slots=[...] / boot audit: all entries active', '# 期望：ok @montersy123/dsh-skill-market: inject=["slots"] slots=[...] / boot audit: all entries active'],
  ['日志里的 `dsh-skill-market: failed` 就是 `entries.start` 的激活审计结果', '日志里的 `@montersy123/dsh-skill-market: failed` 就是 `entries.start` 的激活审计结果'],
]

const lines = readFileSync(TARGET, 'utf8').split('\n')
for (const [from, to] of LINES) {
  const index = lines.findIndex((line) => line.trim() === from)
  if (index < 0) throw new Error(`line not found: ${JSON.stringify(from)}`)
  // Preserve whatever indentation the line had.
  lines[index] = lines[index].replace(from, to)
  console.log(`line ${String(index + 1)}: ${from.slice(0, 60)} -> ${to.slice(0, 60)}`)
}

if (!apply) {
  console.log('(dry run; pass --apply to write)')
  process.exit(0)
}
writeFileSync(TARGET, lines.join('\n'), 'utf8')
console.log(`wrote ${TARGET}`)
