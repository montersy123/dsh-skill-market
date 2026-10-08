/**
 * Where this plugin's state lives, and where it does not.
 *
 * The storage directory is `$DSH_HOME/storages/@montersy123/dsh-skill-market/data`: inside the place DSH
 * keeps plugin-owned state (the cost meter's ledger sits in `storages/cost-meter`), named by the
 * package's two segments rather than one flattened name, and no longer inside the profile. Nothing reads
 * the place an earlier build used — an upgrade moves the directory by hand, which is a deliberate
 * choice, not an oversight.
 *
 * The path is computed from `DSH_HOME` when the module is imported, so this runs the host half in a child
 * process with a temporary `DSH_HOME` and no `DSH_SKILL_MARKET_ROOT` override. That is the only way to
 * see the real formula without writing into the real home, and only the two path accessors are called —
 * if computing a path created anything, the last assertion here would catch it.
 *
 *   node scripts/state-root-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'skill-market-home-'))

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

// The child prints one JSON line. `DSH_SKILL_MARKET_ROOT` and `..._TEST_ONLY` are emptied rather than
// deleted: an empty override is what the plugin itself treats as "no override".
const printed = execFileSync(process.execPath, ['--input-type=module', '-e', `
  const mod = await import('./lib/index.js')
  console.log(JSON.stringify({
    data: mod.pluginDataRootForTest(),
    disabled: mod.disabledRootForTest(),
  }))
`], {
  cwd: join(import.meta.dirname, '..'),
  env: { ...process.env, DSH_HOME: home, DSH_SKILL_MARKET_ROOT: '', DSH_SKILL_MARKET_TEST_ONLY: '' },
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
})

const paths = JSON.parse(printed.trim().split('\n').pop())
const expected = join(home, 'storages', '@montersy123', 'dsh-skill-market', 'data')

console.log('the state directory')
expect(paths.data === expected, `is $DSH_HOME/storages/@montersy123/dsh-skill-market/data (got ${paths.data})`)
expect(paths.data.includes('profiles') === false, 'and is not inside a profile directory')
expect(paths.disabled === join(expected, 'skills'), `the parked store sits inside it (got ${paths.disabled})`)
expect(existsSync(join(home, 'storages')) === false, 'computing the path creates nothing')

rmSync(home, { recursive: true, force: true })
console.log(`\n${failures === 0 ? 'STATE ROOT OK' : `${String(failures)} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
