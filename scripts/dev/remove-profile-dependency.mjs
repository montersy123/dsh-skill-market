/**
 * Remove the plugin's orphaned dependency entry from a DSH profile.
 *
 * This plugin was uninstalled by the harness, which removed the bundle row and the installed directory but left the
 * `file:` dependency behind — pointing at a local tarball path that has since changed. A profile that declares a
 * dependency it does not have makes every later pnpm operation fail, which is what the user saw.
 *
 * Deliberately narrow: it removes exactly one key, refuses if anything else about the profile looks unexpected, and
 * writes through a temporary file so a failure cannot leave a half-written manifest.
 *
 *   node scripts/dev/remove-profile-dependency.mjs <profileDir> <packageName> [--apply]
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [profileDir, name, ...flags] = process.argv.slice(2)
const apply = flags.includes('--apply')
if (profileDir === undefined || name === undefined) {
  console.error('  usage: node scripts/dev/remove-profile-dependency.mjs <profileDir> <packageName> [--apply]')
  process.exit(1)
}

const manifestPath = join(profileDir, 'package.json')
if (existsSync(manifestPath) === false) {
  console.error(`  FAIL: no package.json at ${manifestPath}`)
  process.exit(1)
}

const before = readFileSync(manifestPath, 'utf8')
const manifest = JSON.parse(before)
const specifier = manifest.dependencies?.[name]

console.log(`  profile        : ${profileDir}`)
console.log(`  dependency     : ${specifier === undefined ? '(absent — nothing to do)' : specifier}`)
console.log(`  bundles        : ${JSON.stringify(manifest.dsh?.profile?.bundles ?? [])}`)
console.log(`  in bundles     : ${String((manifest.dsh?.profile?.bundles ?? []).includes(name))}`)

if (specifier === undefined) {
  console.log('')
  console.log('  nothing to remove')
  process.exit(0)
}

// Refuse if the bundle row is still present: removing the dependency then would leave the profile pointing at a
// bundle it cannot resolve, which is worse than the state being repaired.
if ((manifest.dsh?.profile?.bundles ?? []).includes(name)) {
  console.error('')
  console.error('  FAIL: the package is still listed in dsh.profile.bundles.')
  console.error('  Removing only the dependency would leave a bundle row with nothing behind it.')
  console.error('  Remove the bundle row first, or reinstall and uninstall cleanly.')
  process.exit(1)
}

const installedPath = join(profileDir, 'node_modules', ...name.split('/'))
console.log(`  on disk        : ${String(existsSync(installedPath))}`)
console.log('')

if (apply === false) {
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}

delete manifest.dependencies[name]
// Keep key order stable so the diff is one removed line, not a reordered manifest.
const updated = `${JSON.stringify(manifest, null, 2)}\n`
if (JSON.parse(updated).dependencies?.[name] !== undefined) {
  console.error('  FAIL: the dependency survived serialisation; refusing to write')
  process.exit(1)
}

// Write beside the original and rename, so an interrupted write cannot truncate the manifest.
const temporary = `${manifestPath}.tmp-repair`
writeFileSync(temporary, updated, 'utf8')
copyFileSync(manifestPath, `${manifestPath}.pre-repair`)
renameSync(temporary, manifestPath)

const check = JSON.parse(readFileSync(manifestPath, 'utf8'))
console.log(`  dependency now : ${check.dependencies?.[name] === undefined ? '(removed)' : 'STILL PRESENT'}`)
console.log(`  remaining deps : ${Object.keys(check.dependencies ?? {}).length}`)
console.log(`  bytes          : ${String(Buffer.byteLength(before, 'utf8'))} -> ${String(Buffer.byteLength(updated, 'utf8'))}`)
console.log(`  wrote          : ${manifestPath}`)
