/**
 * Find which check script can write to the REAL skill root.
 *
 * The suite is supposed to be sandboxed by `DSH_SKILL_MARKET_ROOT`, but an ES import hoists
 * above the assignment that sets it, so a script that imports the module at the top can
 * silently operate on the user's own skill root. This fingerprints the real root before and
 * after each script, which names the culprit instead of leaving it to inference.
 *
 * Read-only with respect to the skill itself: it never installs or deletes anything.
 *
 *   node tools/realroot-mutation-probe.mjs            # all scripts
 *   node tools/realroot-mutation-probe.mjs a.mjs b.mjs
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills')

/** A stable fingerprint of the whole real skill root. */
const fingerprint = () => {
  if (existsSync(root) === false) return 'absent'
  const parts = []
  const walk = (dir, base) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name)
      const rel = base === '' ? entry.name : `${base}/${entry.name}`
      if (entry.isDirectory()) walk(full, rel)
      else parts.push(rel + ':' + statSync(full).size + ':' + createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 12))
    }
  }
  walk(root, '')
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16) + ` (${parts.length} files)`
}

const scripts = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['check-client.mjs', 'boot-client-check.mjs', 'skills-provider-check.mjs', 'candidate-contract-demo.mjs',
    'cordis-client-check.mjs', 'disabled-target-check.mjs', 'legacy-saved-check.mjs', 'restart-advice-check.mjs',
    'grid-columns.mjs', 'install-check.mjs', 'render-panel.mjs', 'installed-frontmatter.mjs', 'which-version.mjs']

console.log('real skill root:', root)
const before = fingerprint()
console.log('before         :', before)
console.log('')

const dirty = []
for (const script of scripts) {
  const args = []
  // The two scripts that need special arguments, so this probe actually runs them.
  if (script === 'boot-client-check.mjs') args.push('@montersy123/dsh-skill-market')
  if (script === 'render-panel.mjs') args.push('--fixture', 'tests/fixture', '--viewport', '1440x900')
  const needsResolver = ['skills-provider-check.mjs', 'candidate-contract-demo.mjs', 'cordis-client-check.mjs'].includes(script)
  const nodeArgs = needsResolver ? ['--import', './scripts/asar-resolver.mjs', join('tests', script)] : [join('tests', script)]

  const env = { ...process.env, PANEL_PAGE_URL: 'dsh-app://app/', DSH_PROFILE_DIR: join(homedir(), '.dsh', 'profiles', 'desktop') }
  let status = 'ok'
  try {
    execFileSync(process.execPath, [...nodeArgs, ...args], { env, stdio: 'ignore', timeout: 600_000 })
  } catch (error) {
    status = `exit ${error.status ?? '?'}`
  }
  const after = fingerprint()
  const changed = after !== before
  if (changed) dirty.push(script)
  console.log(`  ${changed ? 'MUTATED' : 'clean  '} ${script.padEnd(30)} ${status}`)
}

console.log('')
console.log(dirty.length === 0
  ? 'NO SCRIPT TOUCHED THE REAL SKILL ROOT'
  : `MUTATING SCRIPTS: ${dirty.join(', ')}`)
