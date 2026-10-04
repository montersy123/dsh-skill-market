/**
 * Exercise the real install path end to end, without a running Harness.
 *
 * This downloads a genuine skill from SkillHub through the plugin's own Host
 * module, writes it into a **temporary skill root**, checks the bytes against the
 * upstream sha256 manifest, and then reads it back through the registry. It removes
 * what it installed unless asked to keep it.
 *
 * The scratch root is not a convenience: this script rewrites a whole skill directory,
 * and running it against the real root once replaced a user's pinned older release with
 * the latest — verified by mtime. A test that mutates the state it is meant to observe
 * cannot be trusted, so it never touches `$DSH_HOME/skills`.
 *
 *   node tools/install-check.mjs                       # installs and removes
 *   node tools/install-check.mjs --keep                # leaves it in the scratch root
 *   node tools/install-check.mjs --slug x --namespace y
 *   node tools/install-check.mjs --version 2.0.1       # a specific release
 */
import { readFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const keep = args.includes('--keep')
const slug = flag('--slug', 'dev-expert')
const namespace = flag('--namespace', 'indiv-ebandao')
const version = flag('--version', '')

// Set before the module is imported: `skillRoot()` reads the environment on every call,
// so this is what keeps the run inside the scratch directory.
const scratch = mkdtempSync(join(tmpdir(), 'skill-market-install-'))
process.env.DSH_SKILL_MARKET_ROOT = scratch
// Fail loudly rather than write to the real skill root if the ordering above ever regresses:
// an ES import hoists above this assignment, which is how this script once installed over the
// user's own pinned release while the comment above claimed it was sandboxed.
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const mod = await import('../lib/index.js')
const root = mod.installedSkillRoot()
console.log('scratch skill root:', root)
if (root !== scratch) throw new Error(`refusing to run against ${root}: expected the scratch root`)

const progress = []
const started = Date.now()
let result
try {
  result = await mod.installSkillForTest(
    version === '' ? { slug, namespace } : { slug, namespace, version },
    (frame) => {
      if (frame.phase === 'downloading' && frame.done % 20 !== 0 && frame.done !== frame.total) return
      progress.push(`${frame.phase} ${frame.done}/${frame.total}`)
    },
  )
} catch (error) {
  console.error('INSTALL FAILED:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}

console.log('\nprogress frames:', progress.slice(0, 8).join(' | '), progress.length > 8 ? `… (${progress.length} total)` : '')
console.log('install result:', JSON.stringify({
  name: result.name,
  files: result.files,
  bytes: result.bytes,
  version: result.version,
  directory: result.directory,
}, null, 2))
console.log(`elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`)

/** Walk the installed tree. */
function walk (dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel))
    else out.push({ path: rel, size: statSync(join(dir, entry.name)).size })
  }
  return out
}

const landed = walk(result.directory)
const instruction = join(result.directory, 'SKILL.md')
const onDisk = {
  files: landed.length,
  bytes: landed.reduce((sum, file) => sum + file.size, 0),
  hasSkillMd: existsSync(instruction),
  topLevel: readdirSync(result.directory).slice(0, 8),
}
console.log('\non disk:', JSON.stringify(onDisk, null, 2))
console.log('SKILL.md head:', readFileSync(instruction, 'utf8').split('\n').slice(0, 3).join(' / ').slice(0, 160))

// The Host's own scan must see the new skill.
const listed = await mod.scanInstalledForTest()
console.log('\ninstalled ledger:', JSON.stringify(listed.map((skill) => ({ directory: skill.directory, name: skill.name, files: skill.files, bytes: skill.bytes })), null, 2))

// Name must be kebab-case or the registry silently drops the skill.
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const frontmatterName = readFileSync(instruction, 'utf8').match(/^name:\s*(.+)$/m)?.[1]?.trim()
console.log('frontmatter name:', JSON.stringify(frontmatterName), '| kebab-case:', kebab.test(frontmatterName ?? ''))

let failures = 0
const expect = (condition, label) => {
  if (condition) console.log(`  ok   ${label}`)
  else { failures += 1; console.error(`  FAIL ${label}`) }
}
console.log('\nassertions:')
expect(onDisk.hasSkillMd, 'SKILL.md landed at the skill root')
expect(onDisk.files === result.files, `file count matches the manifest (${onDisk.files})`)
expect(onDisk.bytes === result.bytes, `byte count matches the reported total (${onDisk.bytes})`)
expect(kebab.test(frontmatterName ?? ''), 'frontmatter name is kebab-case, so the registry will accept it')
// The scan is keyed by directory (`<handle>--<slug>`) and carries the skill's
// registered name from the SKILL.md frontmatter. Both must be present.
const directoryName = result.directory.split(/[\\/]/).pop()
const scanned = listed.find((entry) => entry.directory.endsWith(directoryName))
expect(scanned !== undefined, `the Host scan lists the directory (${directoryName})`)
expect(scanned?.name === result.name, `the scan reports the registered name (${result.name})`)
expect(scanned?.files === result.files, 'the scan counts the same files the install wrote')
expect(existsSync(result.directory), 'the skill directory exists under the plugin root')
expect(directoryName !== result.name, 'directory name and skill name are distinct, as designed')
expect(result.bytes > 0 && result.files > 0, 'the result reports a non-empty install')

if (keep === false) {
  const removed = await mod.uninstallSkillForTest({ name: directoryName })
  console.log('\nuninstalled:', JSON.stringify(removed))
  expect(existsSync(result.directory) === false, 'uninstall removed the directory')
} else {
  console.log('\nkept in the scratch root:', result.directory)
}

// Clean up the scratch tree either way: nothing here belongs on the user's machine.
rmSync(scratch, { recursive: true, force: true })

console.log(failures === 0 ? '\nINSTALL PATH OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
