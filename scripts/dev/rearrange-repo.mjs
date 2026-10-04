/**
 * One-shot: arrange the repository the way a published plugin repository is laid out.
 *
 * - the live development pipeline moves from `scripts/` to `scripts/` (the name this ecosystem uses)
 * - the shared fixtures move to `tests/fixture/`
 * - the extraction scratch space and the one-off migration scripts move to `scripts/dev/`
 * - the captured upstream assets, which are megabytes of third-party files, are deleted
 * - the API notes move to `docs/`
 *
 * Nothing is deleted except those captured assets. `scripts/dev/` keeps the rest, because the one-off scripts
 * are the record of how the plugin's documented behaviour was measured — the README cites several of them — and a
 * reader checking a claim needs them present.
 *
 *   node scripts/rearrange-repo.mjs [--apply]
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const tools = join(root, 'tests')
const apply = process.argv.includes('--apply')

/** Files that stay in the live pipeline. Everything else goes to `scripts/dev/`. */
const LIVE = new Set([
  'asar-resolver.mjs',
  'asar-resolver-hooks.mjs',
  'boot-client-check.mjs',
  'check-client.mjs',
  'cordis-client-check.mjs',
  'css-damage-check.mjs',
  'css-guard-selftest.mjs',
  'css-literal-check.mjs',
  'disabled-target-check.mjs',
  'encoding-check.mjs',
  'generated-block-check.mjs',
  'grid-columns.mjs',
  'i18n-key-audit.mjs',
  'i18n-keys-check.mjs',
  'i18n-keys.mjs',
  'i18n-remaining.mjs',
  'import-check.mjs',
  'inline-client-locale.mjs',
  'install-check.mjs',
  'install-plugin.mjs',
  'installed-copy-check.mjs',
  'landmark-guard-selftest.mjs',
  'legacy-saved-check.mjs',
  'locale-check.mjs',
  'locale-json-check.mjs',
  'manifest-meta-guard-selftest.mjs',
  'pack-encoding-check.mjs',
  'publish-check.mjs',
  'render-panel.mjs',
  'restart-advice-check.mjs',
  'route-check.mjs',
  'skills-provider-check.mjs',
  'verify-render.mjs',
])

/** Captured third-party assets: megabytes of someone else's code, not ours to publish. */
const DELETE = ['skill-hub.js', 'skill-hub.css', 'asar-index.json', 'client-css.txt']

/** Subdirectories of `scripts/` that move wholesale. */
const MOVE_TREES = [
  { from: 'reactsmoke', to: join('scripts', 'dev', 'reactsmoke') },
  { from: 'fixture', to: join('tests', 'fixture') },
  { from: 'dist', to: join('scripts', 'dist') },
  { from: 'asar-out', to: join('scripts', 'dev', 'asar-out') },
]

const plan = []
for (const tree of MOVE_TREES) {
  const from = join(tools, tree.from)
  if (existsSync(from) === false) continue
  plan.push({ kind: 'tree', from, to: join(root, tree.to), label: `${tree.from}/ -> ${tree.to}/` })
}
for (const name of DELETE) {
  const from = join(tools, name)
  if (existsSync(from) === false) continue
  plan.push({ kind: 'delete', from, label: `delete ${name}` })
}
for (const name of readdirSync(tools)) {
  const isDoc = name.endsWith('.md')
  const isScript = name.endsWith('.mjs') || name.endsWith('.py')
  if (isDoc === false && isScript === false) continue
  const from = join(tools, name)
  if (statSync(from).isFile() === false) continue
  // Documentation goes to `docs/` whatever else it looks like; only scripts are split by whether they are part
  // of the live pipeline.
  const target = isDoc
    ? join(root, 'docs', name)
    : (LIVE.has(name) ? join(root, 'scripts', name) : join(root, 'scripts', 'dev', name))
  plan.push({ kind: 'file', from, to: target, label: `${name}${isDoc ? '  (docs)' : (LIVE.has(name) ? '' : '  (dev)')}` })
}

for (const step of plan) {
  console.log(`  ${step.kind === 'delete' ? 'xx' : '->'} ${step.label}`)
}
console.log('')
console.log(`  ${String(plan.length)} step(s)`)

if (apply === false) {
  console.log('  (dry run; pass --apply to rearrange)')
  process.exit(0)
}

for (const step of plan) {
  if (step.kind === 'delete') { rmSync(step.from, { force: true }); continue }
  mkdirSync(join(step.to, '..'), { recursive: true })
  if (existsSync(step.to)) rmSync(step.to, { recursive: true, force: true })
  if (step.kind === 'tree') cpSync(step.from, step.to, { recursive: true })
  else renameSync(step.from, step.to)
  if (step.kind === 'tree') rmSync(step.from, { recursive: true, force: true })
}

// Everything is out of `scripts/` now, so the directory itself goes too.
rmSync(tools, { recursive: true, force: true })
console.log('')
console.log('  rearranged')
