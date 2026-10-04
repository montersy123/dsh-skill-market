/**
 * One-shot: move the plugin package from `` to the repository root.
 *
 * The published repositories in this ecosystem are a single package at the root (`package.json`, `lib/`,
 * `locale/`, `docs/`, `scripts/`), not a workspace with one package inside it. Moving the files is mechanical;
 * what needs care is that nothing is dropped and that a failed run can be retried, so this refuses to overwrite
 * an existing destination and reports exactly what it moved.
 *
 *   node scripts/migrate-to-root.mjs [--apply]
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const source = join(root, 'packages', 'dsh-skill-market')
const apply = process.argv.includes('--apply')

if (existsSync(source) === false) {
  console.error(`  FAIL: no source package at ${source}`)
  process.exit(1)
}

// The package has no `data/` (state lives outside it), but a stray one must not be copied into the repository
// root where it would then be published.
const ENTRIES = ['package.json', 'lib', 'locale', 'icon.svg', 'cordis.patch.yml', 'README.md', 'README.en.md']

const moves = []
for (const entry of ENTRIES) {
  const from = join(source, entry)
  const to = join(root, entry)
  if (existsSync(from) === false) {
    moves.push({ entry, action: 'missing', detail: 'not in the package' })
    continue
  }
  if (existsSync(to)) {
    moves.push({ entry, action: 'skip', detail: 'destination already exists' })
    continue
  }
  const kind = statSync(from).isDirectory() ? 'directory' : 'file'
  moves.push({ entry, action: apply ? 'copy' : 'would copy', detail: kind })
  if (apply) {
    cpSync(from, to, { recursive: true })
  }
}

console.log(`  source: ${source.replace(`${root}\\`, '')}`)
console.log(`  target: the repository root`)
console.log('')
for (const move of moves) {
  const marker = move.action.startsWith('would') ? '-' : (move.action === 'copy' ? 'ok' : '!!')
  console.log(`  ${marker} ${move.entry.padEnd(20)} ${move.action.padEnd(12)} ${move.detail}`)
}

const skipped = moves.filter((move) => move.action === 'skip' || move.action === 'missing')
console.log('')
if (apply === false) {
  console.log('  (dry run; pass --apply to move)')
  process.exit(0)
}
if (skipped.length > 0) {
  console.log(`  ${String(skipped.length)} entr(ies) were not moved; resolve them and re-run`)
  process.exit(1)
}

// Remove the emptied package directory. Its absence is the proof the move completed, so it is verified.
rmSync(join(root, 'packages'), { recursive: true, force: true })
mkdirSync(root, { recursive: true })
console.log(`  packages/ removed: ${String(existsSync(join(root, 'packages')) === false)}`)
console.log('')
console.log('  moved to the repository root')
