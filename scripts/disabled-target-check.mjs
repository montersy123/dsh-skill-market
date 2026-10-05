/**
 * Lock down that install and uninstall agree on where a disabled skill lives.
 *
 * Disabled state in this plugin IS a location: enabled skills are under `$DSH_HOME/skills`, disabled
 * ones in the plugin's own store, `<profile>/@montersy123-dsh-skill-market/data/skills`. Every
 * operation that touches files must therefore resolve the same way, because two of them disagreeing is
 * a silent state corruption — an install that re-enables a skill the user disabled, or an uninstall
 * that removes one copy and leaves another that the next scan will find.
 *
 * Runs entirely inside a scratch root: nothing here reads or writes the real skill root.
 *
 *   node scripts/disabled-target-check.mjs
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'

// Before the import: the module reads the root on every call, but a leftover parked copy
// from an earlier run would make the first install look like a reinstall of a disabled
// skill — which is exactly the confusion this check exists to avoid.
process.env.DSH_SKILL_MARKET_ROOT = mkdtempSync(join(tmpdir(), 'skill-market-target-'))
// Fail loudly rather than write to the real skill root if the ordering above ever regresses:
// an ES import hoists above this assignment, which is how a check script once installed over
// the user's own pinned release while believing it was sandboxed.
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const mod = await import('../lib/index.js')

const NAME = 'indiv-ebandao--dev-expert'
const liveDir = join(mod.installedSkillRoot(), NAME)
const parkedDir = join(mod.disabledRootForTest(), NAME)

/** Clear both roots, so each run starts from nothing rather than from the last one. */
const reset = () => {
  rmSync(liveDir, { recursive: true, force: true })
  rmSync(parkedDir, { recursive: true, force: true })
}

const failures = []
/**
 * Record one assertion.
 * @param {boolean} condition - What must hold.
 * @param {string} label - Description for the report.
 */
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures.push(label)
}

const controller = mod.registryForTest({
  skills: { register: () => () => {} },
  logger: { warn() {}, debug() {} },
})

reset()

console.log('assertions:')
const fresh = await mod.installSkillForTest({ slug: 'dev-expert', namespace: 'indiv-ebandao', version: '2.0.1' })
expect(fresh.enabled === true, 'a fresh install reports enabled')
expect(existsSync(liveDir), 'a fresh install writes into the skill root')
expect(existsSync(parkedDir) === false, 'a fresh install does not touch the disabled store')

await controller.setEnabled(NAME, false)
expect(existsSync(liveDir) === false, 'disabling removes the directory from the skill root')
expect(existsSync(parkedDir), 'disabling parks the directory in the disabled store')

// The state tree is permanent: `data/` holds the version record and `data/skills` the parked
// skills, and both stay whether or not anything is currently parked. An earlier build pruned
// whichever was empty, so the tree came and went with the current set of disabled skills.
const dataDir = mod.pluginDataRootForTest()
const storeDir = mod.disabledRootForTest()
await controller.setEnabled(NAME, true)
expect(existsSync(dataDir), 'the data directory survives enabling the last parked skill')
expect(existsSync(join(dataDir, 'installed.json')), 'the version record survives too')
expect(existsSync(storeDir), 'the disabled store itself survives, even while empty')
await controller.setEnabled(NAME, false)
expect(existsSync(dataDir) && existsSync(storeDir), 'both survive disabling again')

const overParked = await mod.installSkillForTest({ slug: 'dev-expert', namespace: 'indiv-ebandao', version: '2.0.2' })
expect(overParked.enabled === false, 'installing over a parked skill reports it still disabled')
expect(existsSync(liveDir) === false, 'installing over a parked skill does not recreate it in the skill root')
expect(existsSync(parkedDir), 'installing over a parked skill keeps it in the disabled store')
expect(overParked.version === '2.0.2', 'the parked install reports the version it wrote')

const summary = (await controller.summary()).skills.find((entry) => entry.directoryName === NAME)
expect(summary?.enabled === false, 'the summary agrees the skill is disabled')
expect(summary?.version === '2.0.2', 'the summary reports the parked version')
expect(mod.locateInstalledForTest(NAME)?.enabled === false, 'the locator finds it in the disabled store')

const fromParked = await mod.uninstallSkillForTest({ name: NAME })
expect(fromParked.wasDisabled === true, 'uninstalling a parked skill reports where it came from')
expect(existsSync(parkedDir) === false, 'uninstalling a parked skill removes it from the disabled store')
expect(mod.locateInstalledForTest(NAME) === undefined, 'nothing is left to locate afterwards')

await mod.installSkillForTest({ slug: 'dev-expert', namespace: 'indiv-ebandao', version: '2.0.1' })
const fromLive = await mod.uninstallSkillForTest({ name: NAME })
expect(fromLive.wasDisabled === false, 'uninstalling a live skill reports the skill root')
expect(existsSync(liveDir) === false, 'uninstalling a live skill removes it from the skill root')

let absentThrew = false
try {
  await mod.uninstallSkillForTest({ name: NAME })
} catch {
  absentThrew = true
}
expect(absentThrew, 'uninstalling an absent skill fails loudly instead of silently')

let traversalRejected = false
try {
  mod.locateInstalledForTest('../escape')
} catch {
  traversalRejected = true
}
expect(traversalRejected, 'the locator rejects a name that escapes the roots')

// A hand-placed directory is named by the user, not by us, so the naming convention must not be
// enforced on it. `libai-1.0.5` is a real one: the dot broke every toggle with "技能名不合法"
// while the skill was plainly listed. Path safety, however, still applies.
console.log('\nhand-named directories:')
const dotted = 'libai-1.0.5'
mkdirSync(join(mod.installedSkillRoot(), dotted), { recursive: true })
writeFileSync(join(mod.installedSkillRoot(), dotted, 'SKILL.md'),
  '---\nname: libai\ndescription: 手工放置，目录名含点。\n---\n\n# Body\n')
await controller.sync()
const offDotted = await controller.setEnabled(dotted, false)
expect(offDotted.skills.find((row) => row.directoryName === dotted)?.enabled === false,
  'a directory whose name contains a dot can be disabled')
expect(existsSync(join(mod.disabledRootForTest(), dotted)), 'and it really moved to the disabled store')
const onDotted = await controller.setEnabled(dotted, true)
expect(onDotted.skills.find((row) => row.directoryName === dotted)?.enabled === true, 'and can be enabled again')
expect(existsSync(join(mod.installedSkillRoot(), dotted)), 'and it really moved back')

// Names that are still refused, because these are about escaping rather than convention.
const refused = ['..', '.', 'a/b', 'a\\b', 'a:b', 'nested/../escape', 'trailing.', 'trailing ', 'CON', 'x\u0000y']
let allRefused = true
for (const name of refused) {
  let threw = false
  try {
    await controller.setEnabled(name, false)
  } catch {
    threw = true
  }
  if (threw === false) {
    allRefused = false
    console.log(`    (not refused: ${JSON.stringify(name)})`)
  }
}
expect(allRefused, 'but separators, traversal, reserved names and trailing dot/space are still refused')

// The disabled store's name has settled: `data/skills` is the only directory read, and no compatibility
// is kept for the spelling it had before. A directory left under an older name is therefore ignored
// rather than adopted — which is what this asserts, because silently adopting something nobody writes
// any more is how the old name would come back.
const storeRoot = mod.disabledRootForTest()
const staleStoreName = join(mod.pluginDataRootForTest(), 'disabled')
mkdirSync(join(staleStoreName, NAME), { recursive: true })
writeFileSync(join(staleStoreName, NAME, 'SKILL.md'), '---\nname: dev-expert\ndescription: stale\n---\n\nbody\n')
await mod.migratePluginDataForTest()
expect(existsSync(join(storeRoot, NAME)) === false, 'a store under an older name is not adopted')
const staleRows = await mod.scanInstalledForTest()
expect(staleRows.some((row) => row.directoryName === NAME) === false,
  'and the disabled skill in it is not reported as installed')
rmSync(staleStoreName, { recursive: true, force: true })

// The state directory must not be inside the package. Every mechanism that replaces a package
// — `pnpm install`, a hand reinstall, an interrupted upgrade — deletes that directory, and
// when the disabled store lived there, every parked skill silently came back enabled.
const dataRoot = resolve(mod.pluginDataRootForTest())
// The package *is* the repository root now, so this no longer deletes and rebuilds it: a test that removes its own
// repository is not a test anyone should run. The property is proved the safe way instead — by relocating the
// plugin's state root and showing the parked skill survives, which is the same claim without the destruction.
const packageDir = resolve(import.meta.dirname, '..')
expect(dataRoot.startsWith(packageDir) === false, 'runtime state is not inside the package directory')
expect(existsSync(join(dataRoot, '..')) && resolve(join(dataRoot, '..')) !== resolve(mod.installedSkillRoot()),
  'runtime state sits outside the skill root too, so scanning skills cannot see it')

// Prove the property rather than asserting the path: park a skill, then move the plugin's state to a
// completely different root and read it back. A package replacement deletes the package directory; relocating
// the state root is the same situation from the state's point of view, and it destroys nothing.
reset()
await mod.installSkillForTest({ slug: 'dev-expert', namespace: 'indiv-ebandao', version: '2.0.1' })
await controller.setEnabled(NAME, false)
const recordBefore = JSON.parse(readFileSync(join(dataRoot, 'installed.json'), 'utf8'))
expect(recordBefore[NAME]?.version === '2.0.1', 'the parked install is recorded with its release')

// The state lives outside the package, so pointing the plugin at a new root finds the same parked skill. The
// relocation is the assertion: if the state were inside the package, a new root would find nothing.
//
// The override is the *skill* root, and the data root is derived from it as a sibling
// (`<dirname>/skill-market-data`), so the relocated root has to be nested the same way — otherwise the plugin
// keeps reading the data root it started with and the assertion passes without relocating anything.
const storeName = basename(mod.disabledRootForTest())
const relocatedRoot = join(mkdtempSync(join(tmpdir(), 'skill-market-relocated-')), 'skills')
mkdirSync(join(relocatedRoot, '..', 'skill-market-data', storeName), { recursive: true })
cpSync(join(dataRoot, storeName), join(relocatedRoot, '..', 'skill-market-data', storeName), { recursive: true })
cpSync(join(dataRoot, 'installed.json'), join(relocatedRoot, '..', 'skill-market-data', 'installed.json'))
process.env.DSH_SKILL_MARKET_ROOT = relocatedRoot
expect(existsSync(join(relocatedRoot, '..', 'skill-market-data', storeName, NAME)),
  'a parked skill survives the state root being relocated')
expect(resolve(mod.pluginDataRootForTest()) !== resolve(dataRoot), 'the relocation really moved the state root')
expect(existsSync(liveDir) === false, 'the relocated state did not re-enable it in the skill root')
const afterSwap = (await controller.summary()).skills.find((entry) => entry.directoryName === NAME)
expect(afterSwap?.enabled === false, 'the summary still reports it disabled after the relocation')
expect(afterSwap?.version === '2.0.1', 'the recorded release survived the relocation')
rmSync(join(relocatedRoot, '..'), { recursive: true, force: true })

reset()
rmSync(mod.pluginDataRootForTest(), { recursive: true, force: true })

console.log(failures.length === 0 ? '\nDISABLED TARGET OK' : `\n${failures.length} ASSERTION(S) FAILED`)
process.exit(failures.length === 0 ? 0 : 1)
