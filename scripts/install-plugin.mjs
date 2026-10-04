/**
 * Install this plugin into the desktop profile as a REAL directory, not a link.
 *
 * The plugin keeps its own state in `<package>/data`, so a junction made the disabled
 * store live inside the source checkout. A real copy puts the package — and therefore
 * the state — where every other bundle in this profile lives, under `node_modules`.
 *
 * The package is scoped (`@montersy123/dsh-skill-market`), so its directory is the two
 * segments pnpm and npm both use: `node_modules/@montersy123/dsh-skill-market`.
 *
 * ## Why the copy is a packed tarball
 *
 * A `file:<directory>` dependency makes pnpm materialise the package as a **link**,
 * which is the thing being moved away from; and a bare version like `1.0.0` cannot be
 * resolved at all until the package is published (`ERR_PNPM_FETCH_404`). `npm pack`
 * sidesteps both: it builds a tarball honouring the manifest's `files` list — so `data/`
 * is excluded by construction rather than by a filter here — and pnpm installs a tarball
 * as a **real directory** while recording a resolvable entry in the lockfile.
 *
 *   node tools/install-plugin.mjs            # report what would happen
 *   node tools/install-plugin.mjs --apply    # pack, install, verify
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'

// The package is the repository root now, so packing runs from here and the tarball lands in `tests/dist`.
const PACKAGE = '.'
const PROFILE = join(process.env.USERPROFILE ?? '', '.dsh', 'profiles', 'desktop')
const DIST = resolve('scripts', 'dist')
const apply = process.argv.includes('--apply')

const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8'))
// `@scope/name` installs into a nested directory; an unscoped name does not.
const TARGET = join(PROFILE, 'node_modules', ...manifest.name.split('/'))

/** Locate the pnpm the profile was installed with. */
function findPnpm() {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Author Software', 'nvm', '.nodejs', 'pnpm.exe'),
    'pnpm',
  ]
  for (const candidate of candidates) {
    if (candidate === 'pnpm' || existsSync(candidate)) return candidate
  }
  return 'pnpm'
}

/**
 * Run npm's CLI through the current node, without a shell.
 *
 * `npm` on Windows is a `.cmd` shim, which `execFileSync` cannot spawn and which needs a
 * shell that then re-splits the absolute paths this script passes. Invoking npm's own
 * entry script with the running node avoids both. The path is derived from the running
 * node (`<install>/node_modules/npm/bin/npm-cli.js`), so it follows nvm's per-version
 * layout instead of assuming one.
 *
 * @param {string[]} args - npm arguments.
 * @param {string} cwd - Working directory.
 * @returns {void}
 */
function runNpm(args, cwd) {
  const nodeDir = dirname(process.execPath)
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].map((candidate) => resolve(candidate))
  const cli = candidates.find((candidate) => existsSync(candidate))
  if (cli === undefined) throw new Error(`npm-cli.js not found in ${candidates.join(', ')}`)
  execFileSync(process.execPath, [cli, ...args], { cwd, stdio: 'inherit' })
}

/**
 * `lstat` a path without following it, or undefined when it does not exist.
 *
 * `lstatSync` is what makes link detection work: `statSync` follows the link, so a
 * junction looks like an ordinary directory and a recursive remove would walk through
 * it into the checkout. Verified on Windows: `lstatSync(junction).isSymbolicLink()` is
 * `true`, and `rmSync(path, { recursive: false })` unlinks it without touching the target.
 *
 * @param {string} path - Path to inspect.
 * @returns {import('node:fs').Stats | undefined} Entry stats.
 */
function lstat(path) {
  return lstatSync(path, { throwIfNoEntry: false })
}

const current = lstat(TARGET)
const profileManifestPath = join(PROFILE, 'package.json')
const profile = JSON.parse(readFileSync(profileManifestPath, 'utf8'))
/** The dependency specifier as it stands now, for the change report below. */
const profileDependency = profile.dependencies[manifest.name]

console.log('package      :', manifest.name, manifest.version)
console.log('source       :', PACKAGE)
console.log('target       :', TARGET)
console.log('target exists:', current !== undefined, current?.isSymbolicLink() === true ? '(link)' : '(real directory)')
console.log('dependency now:', JSON.stringify(profileDependency))

const legacy = lstat(join(PROFILE, 'node_modules', 'dsh-skill-market'))
if (legacy !== undefined) console.log('legacy unscoped entry:', legacy.isSymbolicLink() ? '(junction)' : '(real directory)')

if (!apply) {
  console.log('\n(dry run; pass --apply to install)')
  process.exit(0)
}

// 0. Adopt any runtime state still sitting in an older location, BEFORE the package is replaced.
//
//    The disabled store and the version record have moved with the plugin: once inside
//    `<package>/data`, then at `$DSH_HOME/skill-market/data`, now under the profile next to the
//    publisher scope. Every move risks leaving parked skills behind, where the next scan simply
//    does not find them and they come back enabled. This is the last moment the older copies
//    can be rescued, because the package directory is about to be deleted.
//
//    This is a migration, not a save/restore: after it runs the state is outside the package
//    for good, and no future install has to remember to preserve anything.
const stateRoot = join(
  process.env.DSH_PROFILE_DIR ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'desktop'),
  '@montersy123-dsh-skill-market', 'data',
)
const profileDir = process.env.DSH_PROFILE_DIR
  ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'desktop')
const olderStateRoots = [
  join(TARGET, 'data'),
  join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skill-market', 'data'),
  // The profile-scoped spellings this directory used while it was being settled.
  join(profileDir, 'montersy123', 'skill-market', 'data'),
  join(profileDir, '@montersy123', 'skill-market', 'data'),
  join(profileDir, '@montersy123-skill-market', 'data'),
].filter((root) => resolve(root) !== resolve(stateRoot))

const adopted = []
for (const older of olderStateRoots) {
  if (existsSync(older) === false) continue
  const olderDisabled = join(older, 'disabled')
  if (existsSync(olderDisabled)) {
    mkdirSync(join(stateRoot, 'disabled'), { recursive: true })
    for (const entry of readdirSync(olderDisabled)) {
      const to = join(stateRoot, 'disabled', entry)
      if (existsSync(to)) continue
      cpSync(join(olderDisabled, entry), to, { recursive: true })
      adopted.push(entry)
    }
  }
  const olderRecord = join(older, 'installed.json')
  if (existsSync(olderRecord) && existsSync(join(stateRoot, 'installed.json')) === false) {
    mkdirSync(stateRoot, { recursive: true })
    cpSync(olderRecord, join(stateRoot, 'installed.json'))
    adopted.push('installed.json')
  }
  if (adopted.length > 0) {
    console.log(`adopted state from ${older}`)
    console.log(`  into ${stateRoot}`)
  }
  rmSync(older, { recursive: true, force: true })
  // Walk up while each level is empty, so `montersy123/` and `skill-market/` go too: an empty
  // tree that looks like state is worse than no tree.
  let shell = dirname(older)
  while (resolve(shell) !== resolve(profileDir) && existsSync(shell) && readdirSync(shell).length === 0) {
    rmSync(shell, { recursive: true, force: true })
    shell = dirname(shell)
  }
}

// 1. Pack. The manifest's `files` list decides the contents, so runtime state under
//    `data/` is excluded by construction. The destination must exist: `npm pack` writes
//    into it and does not create it.
rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })
runNpm(['pack', '--pack-destination', DIST], PACKAGE)
const tarball = readdirSync(DIST).find((name) => name.endsWith('.tgz'))
if (tarball === undefined) throw new Error(`npm pack produced no tarball in ${DIST}`)
const tarballPath = join(DIST, tarball)
console.log('packed       :', tarballPath)

// 2. Remove the old junction first: a recursive remove would follow it into the source.
if (legacy !== undefined) {
  if (legacy.isSymbolicLink()) rmSync(join(PROFILE, 'node_modules', 'dsh-skill-market'), { recursive: false, force: true })
  else rmSync(join(PROFILE, 'node_modules', 'dsh-skill-market'), { recursive: true, force: true })
}

// 3. Install. The dependency is declared first (with the tarball path), then a forced
//    install rebuilds the directory from it.
//
//    `pnpm add <file:…>` alone is not enough: the tarball keeps its filename while the
//    code changes — the version only moves on release — so pnpm sees an already-satisfied
//    dependency and leaves the previous copy in place. Measured directly: the script
//    reported success while `node_modules/.../lib` still held the old code. Removing the
//    directory and forcing a reinstall makes the copy match the pack, every time.
const specifier = `file:${tarballPath.replace(/\\/g, '/')}`
if (profileDependency !== specifier) {
  profile.dependencies[manifest.name] = specifier
  writeFileSync(profileManifestPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8')
  console.log('dependency   :', specifier)
}
if (current !== undefined) rmSync(TARGET, { recursive: true, force: true })
execFileSync(findPnpm(), ['install', '--force', '--ignore-scripts'], { cwd: PROFILE, stdio: 'inherit' })

// 4. Drop the legacy unscoped dependency and roster entry, if a previous revision left them.
const refreshed = JSON.parse(readFileSync(profileManifestPath, 'utf8'))
let manifestChanged = false
if (refreshed.dependencies['dsh-skill-market'] !== undefined) {
  delete refreshed.dependencies['dsh-skill-market']
  manifestChanged = true
  console.log('removed legacy dependency: dsh-skill-market')
}
const bundles = refreshed.dsh?.profile?.bundles
if (Array.isArray(bundles)) {
  const index = bundles.indexOf('dsh-skill-market')
  if (index >= 0) {
    bundles[index] = manifest.name
    manifestChanged = true
    console.log(`bundle roster: dsh-skill-market -> ${manifest.name}`)
  }
}
if (manifestChanged) writeFileSync(profileManifestPath, `${JSON.stringify(refreshed, null, 2)}\n`, 'utf8')

// 5. Materialise the package from the tarball this run just built.
//
//    pnpm does NOT reliably refresh a `file:` tarball whose contents changed but whose
//    path did not: with the same filename and version, it can consider the dependency
//    satisfied and leave the previous copy — or nothing at all — in place. Measured: the
//    script printed a full install while `lib/client.js` on disk was still two revisions
//    old. So the tarball is unpacked here and copied in, which removes pnpm's cache from
//    the correctness path entirely. It stays the declared dependency and the lockfile
//    entry, so the profile remains honest about where the package comes from.
//
//    Runtime state needs no handling here: step 0 moved it out of the package for good, so
//    replacing this directory cannot lose a parked skill or a version record.
rmSync(TARGET, { recursive: true, force: true })
mkdirSync(TARGET, { recursive: true })
const unpack = join(DIST, 'unpacked')
rmSync(unpack, { recursive: true, force: true })
mkdirSync(unpack, { recursive: true })
execFileSync('tar', ['-xzf', tarballPath, '-C', unpack], { stdio: 'inherit' })
const unpacked = join(unpack, 'package')
if (existsSync(unpacked) === false) throw new Error(`tarball did not contain a package/ directory: ${tarballPath}`)
cpSync(unpacked, TARGET, { recursive: true })
rmSync(unpack, { recursive: true, force: true })

// 6. Verify what is actually on disk.
const installed = lstat(TARGET)
console.log('\nverified:')
console.log(`  is a real directory : ${installed !== undefined && installed.isSymbolicLink() === false}`)
for (const entry of ['lib', 'locale', 'icon.svg', 'cordis.patch.yml', 'package.json']) {
  console.log(`  ${entry.padEnd(19)}: ${existsSync(join(TARGET, entry)) ? 'ok' : 'MISSING'}`)
}
const parked = join(stateRoot, 'disabled')
const parkedCount = existsSync(parked) ? readdirSync(parked).length : 0
console.log(`  ${'data/'.padEnd(19)}: ${existsSync(join(TARGET, 'data')) ? 'PRESENT (should not be — state now lives outside the package)' : 'inside the package: none (correct)'}`)
console.log(`  ${'runtime state'.padEnd(19)}: ${stateRoot}`)
console.log(`  ${'  parked skills'.padEnd(19)}: ${String(parkedCount)}${adopted.length > 0 ? ` (adopted ${String(adopted.length)} from the package)` : ''}`)
console.log('\nrestart DeepSeek Harness for the new bundle row to load')
