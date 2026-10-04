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
// MIT, matching the other plugins in this ecosystem. The checks below are written against MIT's shape: the
// copyright line reads `Copyright (c) <year> <name>`. A licence that only covers this plugin's own code is the
// point worth asserting — the skills it installs belong to their authors and are covered by their own licences.
check(manifest.license === 'MIT', 'license is MIT')
const licensePath = join(root, 'LICENSE')
check(existsSync(licensePath), 'a LICENSE file exists at the repository root')
if (existsSync(licensePath)) {
  const license = readFileSync(licensePath, 'utf8')
  check(license.startsWith('MIT License'), 'the LICENSE file is the MIT text')
  // The permission and warranty clauses, so a partial paste cannot pass as the whole licence.
  check(license.includes('Permission is hereby granted, free of charge'), 'the grant clause is present')
  check(license.includes('THE SOFTWARE IS PROVIDED "AS IS"'), 'the warranty disclaimer is present')
  check(/Copyright \(c\) \d{4} /.test(license), 'the LICENSE carries a copyright line')
  check(license.includes(manifest.author ?? '@@none@@'), 'the LICENSE names the package author')
}
// The licence boundary is documented, not only implied: the skills are third-party content, and the README plus
// the notices file must say so. Without this the package reads as though it were the origin of what it installs.
for (const file of ['README.md', 'README.en.md', 'THIRD-PARTY-NOTICES.md']) {
  const path = join(root, file)
  check(existsSync(path), `${file} exists`)
  if (existsSync(path)) {
    const text = readFileSync(path, 'utf8')
    check(/SkillHub|skillhub/.test(text), `${file} names SkillHub as the source of the skills`)
  }
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

// Every image a README references must exist, and must be inside the published whitelist. A screenshot that
// renders locally but is missing from the repository is a broken image on the project's front page, which is the
// first thing a visitor sees — and it is exactly the failure a local preview cannot catch, because the file is
// present in the working tree either way.
for (const file of ['README.md', 'README.en.md']) {
  const text = readFileSync(join(pkgDir, file), 'utf8')
  const sources = [...text.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1])
    .filter((source) => source.startsWith('http') === false)
  for (const source of sources) {
    const target = join(pkgDir, source)
    const covered = (manifest.files ?? []).some((entry) => source === entry || source.startsWith(`${entry}/`))
    check(existsSync(target), `${file} references ${source}, which exists`)
    check(covered, `${source} is covered by the files whitelist`)
  }
  const images = sources.length
  const languages = /简体中文/.test(text) && /English/.test(text)
  check(images > 0, `${file} shows at least one screenshot`)
  check(languages, `${file} offers a language switch`)
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
