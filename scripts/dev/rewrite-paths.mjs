/**
 * One-shot: rewrite the path references in every development script after the move to a root-level package.
 *
 * The scripts moved from `scripts/` to `scripts/` and `scripts/dev/`, and the package moved from
 * `` to the repository root, so both the package prefix and some relative depths
 * changed. A script that still points at the old location does not fail loudly — it reads a missing file and
 * reports a check failure — so every rewritten path is listed rather than summarised.
 *
 *   node scripts/rewrite-paths.mjs [--apply]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const apply = process.argv.includes('--apply')

/** Every script in the repository, at any depth under `scripts/`. */
function scriptsUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { scriptsUnder(path, out); continue }
    if (name.endsWith('.mjs')) out.push(path)
  }
  return out
}

const files = scriptsUnder(join(root, 'scripts'))

// Order matters: the longer, more specific prefixes are replaced first, or a partial match would leave a
// doubled prefix behind.
const RULES = [
  // Absolute-ish references from the repository root.
  { from: 'lib/', to: 'lib/' },
  { from: '', to: '' },
  { from: 'packages\\dsh-skill-market\\lib\\', to: 'lib\\' },
  { from: 'packages\\dsh-skill-market\\', to: '' },
  // Relative jumps. A script in `scripts/` reaches the package with `../`, and one in `scripts/dev/` with `../../`.
  { from: "'../", to: "'../" },
  { from: "'../../", to: "'../../" },
  { from: '"../', to: '"../' },
  { from: '"../../', to: '"../../' },
  { from: 'join(import.meta.dirname, \'..\', \'packages\', \'dsh-skill-market\'', to: 'join(import.meta.dirname, \'..\'' },
  // `scripts/` no longer exists; the fixture lives under `tests/`.
  { from: "'tests/fixture'", to: "'tests/fixture'" },
  { from: "'tests'", to: "'tests'" },
  { from: 'tests/fixture', to: 'tests/fixture' },
  // Paths written with the old tools directory for the harness's own siblings.
  { from: "'./", to: "'./" },
]

const changes = []
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  let after = before
  const applied = []
  for (const rule of RULES) {
    if (after.includes(rule.from) === false) continue
    const count = after.split(rule.from).length - 1
    after = after.split(rule.from).join(rule.to)
    applied.push(`${rule.from} -> ${rule.to || '(removed)'}  x${String(count)}`)
  }
  if (after === before) continue
  const relative = file.replace(`${root}\\`, '').replace(`${join(root, '')}`, '')
  changes.push({ file: relative, applied })
  if (apply) writeFileSync(file, after, 'utf8')
}

console.log(`  ${String(files.length)} script(s) scanned`)
console.log(`  ${String(changes.length)} need rewriting`)
console.log('')
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
