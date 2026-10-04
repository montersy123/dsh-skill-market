/**
 * One-shot: point every remaining `scripts/...` reference at its new location.
 *
 * The first pass rewrote package prefixes but not the directory the scripts themselves moved out of, so several
 * still resolve `scripts/dev/asar-out`, `scripts/dev/reactsmoke`, or `tests/fixture` — paths that no longer exist and
 * would fail as "missing" rather than as an obvious error. Usage examples in the header comments are rewritten
 * too: they are documentation, and a reader following them would run a command that cannot work.
 *
 *   node scripts/rewrite-tool-paths.mjs [--apply]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = join(import.meta.dirname, '..')
const apply = process.argv.includes('--apply')

/** Every `.mjs` under `scripts/`, at any depth. */
function scriptsUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { scriptsUnder(path, out); continue }
    if (name.endsWith('.mjs')) out.push(path)
  }
  return out
}

// Longest first: `scripts/dev/reactsmoke` must be handled before a bare `.tools`.
const RULES = [
  { from: 'scripts/dev/reactsmoke', to: 'scripts/dev/reactsmoke' },
  { from: 'scripts/dev/asar-out', to: 'scripts/dev/asar-out' },
  { from: 'tests/fixture', to: 'tests/fixture' },
  { from: 'scripts/', to: 'scripts/' },
  { from: "'scripts'", to: "'scripts'" },
  { from: resolve(root, 'scripts').replace(/\\/g, '/'), to: resolve(root, 'scripts').replace(/\\/g, '/') },
]

const changes = []
for (const file of scriptsUnder(join(root, 'scripts'))) {
  const before = readFileSync(file, 'utf8')
  let after = before
  const applied = []
  for (const rule of RULES) {
    if (after.includes(rule.from) === false) continue
    const count = after.split(rule.from).length - 1
    after = after.split(rule.from).join(rule.to)
    applied.push(`${rule.from} -> ${rule.to}  x${String(count)}`)
  }
  if (after === before) continue
  const relative = file.replace(`${root}\\`, '').replace(`${root}/`, '')
  changes.push({ file: relative, applied })
  if (apply) writeFileSync(file, after, 'utf8')
}

console.log(`  ${String(changes.length)} script(s) need rewriting`)
for (const change of changes) {
  console.log(`  ${change.file}`)
  for (const line of change.applied) console.log(`      ${line}`)
}
if (apply === false) {
  console.log('')
  console.log('  (dry run; pass --apply to rewrite)')
  process.exit(0)
}
console.log('')
console.log('  rewritten')
