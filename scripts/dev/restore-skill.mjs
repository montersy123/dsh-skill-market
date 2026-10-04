/**
 * Reinstall one named release into the REAL skill root.
 *
 * The check scripts are sandboxed and must stay that way; this is the deliberate opposite,
 * for repairing the skill root by hand after a test run polluted it. It states the resolved
 * paths and refuses to act unless the root really is `$DSH_HOME/skills`, so a stray
 * environment override cannot turn a repair into a second accident.
 *
 * It loads the **installed** copy of the plugin, not the source tree, because that is the
 * module the running harness loads. The difference is not cosmetic: the install record lives
 * beside whichever copy performed the install, so repairing through the source tree left the
 * installed copy still claiming the old version — a repair that looked right and wasn't.
 * Set `RESTORE_FROM_SOURCE=1` to target the source tree on purpose.
 *
 *   node tools/restore-skill.mjs <handle> <slug> <version>
 *   node tools/restore-skill.mjs indiv-ebandao dev-expert 2.0.2
 */
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const handle = process.argv[2]
const slug = process.argv[3]
const version = process.argv[4]
if (handle === undefined || slug === undefined || version === undefined) {
  console.error('usage: node tools/restore-skill.mjs <handle> <slug> <version>')
  process.exit(2)
}

// A repair must never run inside a sandbox: that would write to a temp tree and report
// success while the real root stayed broken.
if (String(process.env.DSH_SKILL_MARKET_ROOT ?? '').trim() !== '') {
  console.error('refusing: DSH_SKILL_MARKET_ROOT is set, so this would not touch the real root')
  process.exit(2)
}

const fromSource = String(process.env.RESTORE_FROM_SOURCE ?? '').trim() !== ''
const packageDir = fromSource
  ? resolve(import.meta.dirname, '..', '..')
  : join(
    process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    'profiles', 'desktop', 'node_modules', '@montersy123', 'dsh-skill-market',
  )
const entry = join(packageDir, 'lib', 'index.js')
if (existsSync(entry) === false) {
  console.error(`refusing: no plugin at ${entry}`)
  process.exit(2)
}

const mod = await import(pathToFileURL(entry).href)
const root = mod.installedSkillRoot()
const expected = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills')
const name = `${handle}--${slug}`

console.log('module      :', fromSource ? '(source tree)' : '(installed copy)', packageDir)
console.log('skill root  :', root)
console.log('plugin data :', mod.pluginDataRootForTest())
console.log('target      :', name, 'v' + version)
if (resolve(root) !== resolve(expected)) {
  console.error(`refusing: resolved root is not ${expected}`)
  process.exit(2)
}

// A parked copy of the same skill would shadow the repair, so clear it first.
const parked = join(mod.disabledRootForTest(), name)
if (existsSync(parked)) {
  rmSync(parked, { recursive: true, force: true })
  console.log('removed parked copy:', parked)
}

const result = await mod.installSkillForTest({ slug, namespace: handle, version })
console.log('\ninstalled   : v' + result.version, '|', result.files, 'files | enabled=' + result.enabled)
console.log('directory   :', result.directory)
