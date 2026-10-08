/**
 * Test whether the desktop profile can be installed from scratch, without touching the live one.
 *
 * The live profile's modules directory triggers `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`, and pnpm's answer is
 * to purge and reinstall it. Doing that on the live profile to find out whether it works is the wrong order: if the
 * reinstall fails, four working plugins are gone. This copies the profile's manifests (not its modules directory)
 * and runs a real install in the copy, so "would a reinstall succeed" becomes a fact instead of a gamble.
 *
 *   node scripts/dev/test-profile-reinstall.mjs [--apply]
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const live = process.env.DSH_PROFILE_DIR ?? join(homedir(), '.dsh', 'profiles', 'desktop')
const apply = process.argv.includes('--apply')

if (existsSync(join(live, 'package.json')) === false) {
  console.error(`  FAIL: no profile at ${live}`)
  process.exit(1)
}

const scratch = mkdtempSync(join(tmpdir(), 'profile-reinstall-'))
console.log(`  live profile : ${live}`)
console.log(`  scratch      : ${scratch}`)
console.log('')

if (apply === false) {
  console.log('  (dry run; pass --apply to run the install in the copy)')
  process.exit(0)
}

try {
  // Only the manifests and lock files: copying the modules directory is what we are trying to avoid depending on.
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'cordis.patch.yml']) {
    const from = join(live, name)
    if (existsSync(from)) {
      cpSync(from, join(scratch, name))
      console.log(`  copied ${name}`)
    }
  }

  console.log('')
  console.log('  --- pnpm install (fresh, in the copy) ---')
  let output = ''
  try {
    output = execFileSync('npx.cmd', ['--yes', 'pnpm@9', 'install', '--workspace-root'], {
      cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, timeout: 1_500_000,
    })
  } catch (error) {
    output = `${String(error.stdout ?? '')}\n${String(error.stderr ?? '')}`
  }

  const lines = output.split('\n').filter((line) => line.trim() !== '')
  console.log(lines.slice(-24).map((line) => `    ${line.replace(/\u001b\[[0-9;]*m/g, '')}`).join('\n'))

  const installed = existsSync(join(scratch, 'node_modules', 'dsh-context'))
  console.log('')
  console.log(`  dsh-context installed in the copy: ${String(installed)}`)
  console.log(`  VERDICT: a fresh install ${installed ? 'SUCCEEDS — the live profile can be recreated' : 'FAILS — do NOT purge the live modules directory'}`)

  // Record the failure verbatim: the message is what a fix has to satisfy.
  if (installed === false) {
    writeFileSync(join(live, '..', 'reinstall-probe.log'), output, 'utf8')
    console.log(`  full log written to ${join(live, '..', 'reinstall-probe.log')}`)
  }
  void readFileSync
} finally {
  rmSync(scratch, { recursive: true, force: true })
  console.log('')
  console.log('  scratch copy removed; the live profile was never touched')
}
