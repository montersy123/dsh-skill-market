/**
 * Verify the package is ready to publish, against the requirements on
 * https://dshx.dev/docs/develop/publish/.
 *
 * The failure modes here are all quiet ones: a `files` whitelist that omits a directory means the tarball
 * installs and then cannot load; a manifest whose patch path is wrong means `dsh plugin add` prints a
 * warning and activates nothing; a missing license field is a legal problem rather than a broken build.
 *
 *   node scripts/publish-check.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// The package sits at the repository root, so the manifest and everything it names resolve from there.
const pkgDir = root
const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const failures = []
const ok = []

const check = (condition, message) => { (condition ? ok : failures).push(message) }

// ── the bundle manifest, which is what makes the package installable at all ──
check(manifest.dsh?.bundle?.patch !== undefined, 'dsh.bundle.patch is declared')
const patchPath = join(pkgDir, String(manifest.dsh?.bundle?.patch ?? '').replace(/^\.\//, ''))
check(existsSync(patchPath), `the patch file exists (${manifest.dsh?.bundle?.patch})`)
const patchText = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
check(patchText.includes(manifest.name), 'the patch references this package by name, not by a source path')

// ── `files`: everything the runtime loads must be inside the whitelist ──
const files = manifest.files ?? []
for (const needed of ['lib', 'cordis.patch.yml', 'README.md']) {
  check(files.includes(needed), `files includes ${needed}`)
}
// Every export target must live under a whitelisted directory, or a published install cannot resolve it.
// `package.json` is exempt: npm always includes it, whether or not `files` names it.
for (const [key, target] of Object.entries(manifest.exports ?? {})) {
  const clean = String(target).replace(/^\.\//, '')
  if (clean.includes('*') || clean === 'package.json') continue
  const covered = files.some((entry) => clean === entry || clean.startsWith(`${entry}/`))
  check(covered, `export "${key}" -> ${clean} is covered by files`)
}
// The client half is reached through its export, so it must be present and parse.
const clientPath = join(pkgDir, 'lib', 'client.js')
check(existsSync(clientPath), 'lib/client.js exists')
check(existsSync(join(pkgDir, 'lib', 'index.js')), 'lib/index.js exists')
check(existsSync(join(pkgDir, 'lib', 'locale.js')), 'lib/locale.js exists')

// ── a git install runs no build step, so the shipped code must already be runnable ──
const scripts = manifest.scripts ?? {}
check(scripts.prepare === undefined || typeof scripts.prepare === 'string',
  'no prepare script is needed (source is plain JS); declared prepare: ' + String(scripts.prepare ?? 'none'))
const isPlainJs = readFileSync(join(pkgDir, 'lib', 'index.js'), 'utf8').includes('export ')
check(isPlainJs, 'lib/index.js is already ESM source, so a git install needs no build')

// ── licensing and repository metadata, which the registry page shows ──
// Apache-2.0 rather than MIT: it carries an explicit patent grant and contribution terms, which MIT does not
// address at all. The checks below are written against Apache's shape — the appendix names the copyright holder
// as `Copyright <year> <name>`, without the `(c)` that MIT uses.
check(manifest.license === 'Apache-2.0', 'license is Apache-2.0')
const licensePath = join(root, 'LICENSE')
check(existsSync(licensePath), 'a LICENSE file exists at the repository root')
if (existsSync(licensePath)) {
  const license = readFileSync(licensePath, 'utf8')
  check(license.includes('Apache License') && license.includes('Version 2.0, January 2004'),
    'the LICENSE file is the Apache License 2.0 text')
  // The appendix placeholder must have been filled in: shipping the literal `[yyyy] [name of copyright owner]`
  // leaves the copyright holder unnamed, which is the one field Apache's instructions ask you to complete.
  check(license.includes('[yyyy]') === false, 'the appendix placeholder was replaced')
  check(/Copyright \d{4} /.test(license), 'the LICENSE carries a copyright line')
  check(license.includes(manifest.author ?? '@@none@@'), 'the LICENSE names the package author')
}
check(typeof manifest.repository?.url === 'string', 'repository.url is set')
check(typeof manifest.homepage === 'string', 'homepage is set')
check(Array.isArray(manifest.keywords) && manifest.keywords.includes('dsh-plugin'),
  'keywords include dsh-plugin, which is how the ecosystem finds it')

// ── both READMEs ship and cross-link ──
const readme = readFileSync(join(pkgDir, 'README.md'), 'utf8')
check(existsSync(join(pkgDir, 'README.en.md')), 'README.en.md exists')
check(readme.includes('README.en.md'), 'README.md links to the English edition')
if (existsSync(join(pkgDir, 'README.en.md'))) {
  const english = readFileSync(join(pkgDir, 'README.en.md'), 'utf8')
  check(english.includes('README.md'), 'README.en.md links back to the Chinese edition')
}

// ── sizes worth knowing before publishing ──
const clientSize = statSync(clientPath).size
const localeSize = statSync(join(pkgDir, 'lib', 'locale.js')).size
const readmeSize = statSync(join(pkgDir, 'README.md')).size
console.log(`  lib/client.js  ${(clientSize / 1024).toFixed(1)} KB (includes the inlined dictionaries)`)
console.log(`  lib/locale.js  ${(localeSize / 1024).toFixed(1)} KB`)
console.log(`  README.md      ${(readmeSize / 1024).toFixed(1)} KB`)
console.log('')

for (const line of ok) console.log('  ok   ' + line)
console.log('')
if (failures.length === 0) {
  console.log('PUBLISH READY')
  process.exit(0)
}
for (const line of failures) console.error('  FAIL ' + line)
console.error(`\n${failures.length} PROBLEM(S)`)
process.exit(1)
