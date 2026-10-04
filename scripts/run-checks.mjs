/**
 * Run the whole self-check suite and report each script's exit code.
 *
 * The suite has no runner, and the ad-hoc way it was being run — piping each script through `Select-Object -Last 1`
 * — reported several scripts as passing when they were failing, because the line it printed came from stderr rather
 * than from the script's verdict. Exit codes cannot be misread that way, so this runs every check and summarises
 * them. It is also what `npm test` should have been from the start.
 *
 *   node scripts/run-checks.mjs [--quiet]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const quiet = process.argv.includes('--quiet')

/**
 * The suite, in the order a contributor should see it: syntax, then the package's own contracts, then behaviour.
 * Each entry is `[script, extraArgs]`; a script that needs an argument is given one here rather than skipped, so
 * nothing quietly drops out of the run.
 */
const CHECKS = [
  // Syntax, before anything that would fail confusingly on a parse error.
  ['node', ['--check', 'lib/index.js']],
  ['node', ['--check', 'lib/client.js']],
  ['node', ['--check', 'lib/locale.js']],
  // The package's own contracts.
  ['node', ['scripts/locale-check.mjs']],
  ['node', ['scripts/locale-json-check.mjs']],
  ['node', ['scripts/generated-block-check.mjs']],
  ['node', ['scripts/inline-client-locale.mjs', '--check']],
  ['node', ['scripts/i18n-remaining.mjs']],
  ['node', ['scripts/i18n-key-audit.mjs']],
  ['node', ['scripts/i18n-keys-check.mjs']],
  ['node', ['scripts/encoding-check.mjs']],
  // The stylesheet, which is one template literal and easy to break with a stray backtick.
  ['node', ['scripts/css-literal-check.mjs']],
  ['node', ['scripts/css-damage-check.mjs']],
  ['node', ['scripts/css-guard-selftest.mjs']],
  ['node', ['scripts/css-scroll-check.mjs']],
  ['node', ['scripts/css-scroll-guard-selftest.mjs']],
  ['node', ['scripts/landmark-guard-selftest.mjs']],
  ['node', ['scripts/manifest-meta-guard-selftest.mjs']],
  // The shipped package.
  ['node', ['scripts/pack-encoding-check.mjs']],
  ['node', ['scripts/publish-check.mjs']],
  ['node', ['scripts/installed-copy-check.mjs']],
  // Behaviour, over a real HTTP server or a rendered panel.
  ['node', ['scripts/route-check.mjs']],
  ['node', ['scripts/import-check.mjs']],
  ['node', ['scripts/disabled-target-check.mjs']],
  ['node', ['scripts/install-check.mjs']],
  ['node', ['scripts/legacy-saved-check.mjs']],
  ['node', ['scripts/restart-advice-check.mjs']],
  ['node', ['scripts/grid-columns.mjs']],
  ['node', ['scripts/verify-render.mjs']],
  // Runtime contracts from the shipped Harness.
  ['node', ['--import', './scripts/asar-resolver.mjs', 'scripts/skills-provider-check.mjs']],
  ['node', ['--import', './scripts/asar-resolver.mjs', 'scripts/cordis-client-check.mjs']],
]

const results = []
for (const [command, args] of CHECKS) {
  const label = args.filter((arg) => arg.endsWith('.mjs')).join(' ') || args.join(' ')
  let ok = true
  let output = ''
  try {
    output = execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    ok = false
    output = `${String(error.stdout ?? '')}\n${String(error.stderr ?? '')}`
  }
  results.push({ label, ok, output })
  if (quiet === false) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`)
    if (ok === false) {
      for (const line of output.split('\n').filter((line) => line.trim() !== '').slice(-6)) {
        console.log(`        ${line.trim().slice(0, 110)}`)
      }
    }
  }
}

const failed = results.filter((result) => result.ok === false)
console.log('')
console.log(`  ${String(results.length - failed.length)}/${String(results.length)} check(s) passed`)
if (failed.length > 0) {
  console.error(`\n${String(failed.length)} CHECK(S) FAILED`)
  for (const result of failed) console.error(`  ${result.label}`)
  process.exit(1)
}
console.log('ALL CHECKS PASSED')
