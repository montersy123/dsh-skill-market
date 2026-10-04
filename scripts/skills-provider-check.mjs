/**
 * Contract test for the live installed-skill registrations, driven through the
 * REAL skill registry (`@deepseek-ai/dsh-skill`'s `SkillRegistry`) and the real
 * Cordis runtime.
 *
 * Two things are pinned here, both of which broke in earlier revisions:
 *
 *  1. **Field contract.** The registry validates everything a registrant hands it,
 *     and a validation throw empties the WHOLE catalog — including the harness's
 *     built-in skills — rather than skipping one entry. A bad skill must never
 *     reach it.
 *  2. **Liveness.** Install / enable / disable must take effect in the running
 *     session. That is why this plugin registers skills live instead of publishing
 *     them through a provider: a provider's catalog is only re-read when something
 *     calls `invalidate()`, and a profile with no watching skill provider never
 *     does. This test asserts the live behaviour directly.
 *
 *   node --import ./scripts/asar-resolver.mjs tools/skills-provider-check.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ASAR_OUT = resolve('scripts/dev/asar-out')

// Point the plugin's skill root at a scratch directory. Set before the module is
// imported, because `skillRoot()` reads the environment on every call.
const scratch = mkdtempSync(join(tmpdir(), 'skill-market-check-'))
process.env.DSH_SKILL_MARKET_ROOT = scratch
// Fail loudly rather than write to the real skill root if the ordering above ever regresses:
// an ES import hoists above this assignment, so a careless reorder would sandbox nothing.
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const cordis = await import(pathToFileURL(join(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/cordis/lib/index.js')).href)
const registryModule = await import(pathToFileURL(join(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/dsh-skill/lib/index.js')).href)
const host = await import('../lib/index.js')

console.log('scratch skill root:', scratch)
console.log('disabled store:', host.disabledRootForTest())

/** Write one skill directory with the given frontmatter, body and a resource. */
function writeSkill (directory, frontmatter, body = '# Body\n') {
  const dir = join(scratch, directory)
  mkdirSync(join(dir, 'references'), { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}`)
  writeFileSync(join(dir, 'references', 'note.md'), 'resource\n')
  return dir
}

writeSkill('publisher--good-skill', 'name: good-skill\ndescription: A well-formed installed skill.')
writeSkill('publisher--quiet-skill', 'name: quiet-skill\ndescription: Opts out of model invocation.\ndisable-model-invocation: true')
writeSkill('publisher--broken-skill', 'description: Missing its name, so it must be skipped.')
writeFileSync(join(scratch, 'stray.md'), '---\nname: stray\ndescription: not a bundle\n---\n')

/** Build a real registry plus the plugin's live controller over one Cordis context. */
function makeHarness () {
  const root = new cordis.Context()
  const registry = new registryModule.SkillRegistry(root)
  const ctx = {
    skills: registry,
    logger: { debug: () => {}, warn: (...args) => console.warn('  [warn]', ...args) },
  }
  return { root, registry, controller: host.registryForTest(ctx) }
}

let failures = 0
const expect = (condition, label) => {
  if (condition) console.log(`  ok   ${label}`)
  else { failures += 1; console.error(`  FAIL ${label}`) }
}

/* ── 1. start() publishes installed skills, live ─────────────────────────── */
console.log('\n1) start() publishes installed skills (this is what needs no restart)')
const { registry, controller } = makeHarness()
const summary = await controller.start()
console.log('   summary:', JSON.stringify(summary.skills.map((skill) => `${skill.name}:${skill.enabled ? 'on' : 'off'}`)))

let listed
try {
  listed = await registry.list()
} catch (error) {
  console.error('  registry.list() THREW — the catalog would be empty:', error.message)
  failures += 1
  listed = []
}
const names = listed.map((skill) => skill.name).sort()
console.log('   catalog:', JSON.stringify(names))
expect(names.includes('good-skill'), 'a well-formed installed skill appears')
expect(names.includes('quiet-skill'), 'a skill with an invocation override appears')
expect(names.includes('broken-skill') === false, 'a skill without a name is skipped')
expect(names.includes('stray') === false, 'a flat .md at the root is ignored')

/* ── 2. every summary the registry exposes is contract-complete ─────────── */
console.log('\n2) summaries are contract-complete')
for (const skill of listed) {
  const ok = typeof skill.invocation?.modelInvocable === 'boolean' && typeof skill.invocation?.userInvocable === 'boolean'
  expect(ok, `${skill.name} carries both invocation booleans`)
  expect(typeof skill.source === 'string' && skill.source.length > 0, `${skill.name} carries a source`)
  expect(typeof skill.provider === 'string' && skill.provider.length > 0, `${skill.name} carries a provider`)
}

/* ── 3. loading returns a definition the registry validates ─────────────── */
console.log('\n3) the loaded definition satisfies validateDefinition')
try {
  const loaded = await registry.get('good-skill')
  expect(loaded !== undefined, 'good-skill loads')
  expect(typeof loaded?.content === 'string' && loaded.content.includes('# Body'), 'the body reaches the consumer')
  expect(loaded?.name === 'good-skill', 'the definition name matches')
  expect(loaded?.resourceBase?.kind === 'directory', 'a directory resource base is exposed')
} catch (error) {
  failures += 1
  console.error('  FAIL registry.get() threw:', error.message)
}
expect(await registry.get('no-such-skill') === undefined, 'an unknown name returns undefined rather than throwing')

/* ── 4. disable moves the directory out, so nothing can read it ─────────── */
console.log('\n4) disable physically removes the skill from the skills root')
const targetDir = 'publisher--good-skill'
const disabledStore = host.disabledRootForTest()
const livePath = join(scratch, targetDir)
const parkedPath = join(disabledStore, targetDir)

const offSummary = await controller.setEnabled(targetDir, false)
expect(offSummary.skills.find((skill) => skill.directory.endsWith(targetDir))?.enabled === false, 'the summary reports it disabled')
expect(existsSync(livePath) === false, 'the directory is gone from the skills root')
expect(existsSync(join(parkedPath, 'SKILL.md')), 'and now lives in the disabled store')
const afterDisable = (await registry.list()).map((skill) => skill.name)
expect(afterDisable.includes('good-skill') === false, 'the disabled skill leaves the live catalog')
expect(afterDisable.includes('quiet-skill'), 'the other skill is untouched')
expect(await registry.get('good-skill') === undefined, 'a disabled skill cannot be loaded')

const onSummary = await controller.setEnabled(targetDir, true)
expect(onSummary.skills.find((skill) => skill.directory.endsWith(targetDir))?.enabled === true, 're-enabling reports it enabled')
expect(existsSync(livePath), 'the directory is back in the skills root')
expect(existsSync(parkedPath) === false, 'and gone from the disabled store')
expect((await registry.list()).map((skill) => skill.name).includes('good-skill'), 'it returns to the live catalog immediately')
expect((await registry.get('good-skill'))?.content?.includes('# Body'), 'and loads again')

// Uninstalling must work from either location.
await controller.setEnabled('publisher--quiet-skill', false)
const removedParked = await host.uninstallSkillForTest({ name: 'publisher--quiet-skill' })
expect(removedParked.from.startsWith(disabledStore), 'uninstall finds a parked skill in the disabled store')
expect(existsSync(join(disabledStore, 'publisher--quiet-skill')) === false, 'and removes it')

// Put it back so later sections still see two skills.
writeSkill('publisher--quiet-skill', 'name: quiet-skill\ndescription: Opts out of model invocation.\ndisable-model-invocation: true')
await controller.sync()

/* ── 5. the location survives a process start ───────────────────────────── */
console.log('\n5) the disabled store survives a restart')
await controller.setEnabled('publisher--quiet-skill', false)
const { registry: restartedRegistry, controller: restarted } = makeHarness()
await restarted.start()
const restartedNames = (await restartedRegistry.list()).map((skill) => skill.name)
expect(restartedNames.includes('good-skill'), 'an enabled skill is registered after start()')
expect(restartedNames.includes('quiet-skill') === false, 'a skill left in the disabled store stays off after start()')

writeSkill('publisher--fresh-skill', 'name: fresh-skill\ndescription: Installed after the process started.')
const synced = await restarted.sync()
expect(synced.skills.some((skill) => skill.directory.endsWith('publisher--fresh-skill')), 'a newly written skill is picked up by sync()')
expect((await restartedRegistry.list()).map((skill) => skill.name).includes('fresh-skill'), 'and appears in the live catalog with no restart')

/* ── 5b. a directory the user copied in by hand ─────────────────────────── */
// A user may drop a skill folder straight into one of the two roots with a file manager. The
// location *is* the state, so each root has to mean exactly one thing: anything under the skill
// root is on, anything under the disabled store is off. Nothing else records the choice, so a
// hand-placed directory must be read the same way an installed one is.
console.log('\n5b) a hand-copied directory is read from its location alone')
writeSkill('publisher--hand-copied', 'name: hand-copied\ndescription: Copied in by hand while running.')
const handSynced = await restarted.sync()
const handRow = handSynced.skills.find((skill) => skill.directoryName === 'publisher--hand-copied')
expect(handRow !== undefined, 'a directory copied into the skills root is discovered')
expect(handRow?.enabled === true, 'and is reported enabled, because the skills root means on')
expect((await restartedRegistry.list()).map((skill) => skill.name).includes('hand-copied'), 'and it is live, with no restart')

// The same directory name in the disabled store is the opposite statement.
rmSync(join(scratch, 'publisher--hand-copied'), { recursive: true, force: true })
const parkedRoot = join(host.disabledRootForTest(), 'publisher--parked-by-hand')
mkdirSync(parkedRoot, { recursive: true })
writeFileSync(join(parkedRoot, 'SKILL.md'), '---\nname: parked-by-hand\ndescription: Parked by hand.\n---\n\n# Body\n')
const parkedSynced = await restarted.sync()
const parkedRow = parkedSynced.skills.find((skill) => skill.directoryName === 'publisher--parked-by-hand')
expect(parkedRow !== undefined, 'a directory copied into the disabled store is discovered too')
expect(parkedRow?.enabled === false, 'and is reported disabled, because that store means off')
expect((await restartedRegistry.list()).map((skill) => skill.name).includes('parked-by-hand') === false,
  'and it is not live')
rmSync(join(host.disabledRootForTest(), 'publisher--parked-by-hand'), { recursive: true, force: true })

/* ── 6. an unreadable root degrades to an empty catalog ─────────────────── */
console.log('\n6) a missing root degrades instead of throwing')
rmSync(scratch, { recursive: true, force: true })
rmSync(host.disabledRootForTest(), { recursive: true, force: true })
const { registry: emptyRegistry, controller: emptyController } = makeHarness()
expect((await emptyController.start()).skills.length === 0, 'a missing root lists nothing')
expect((await emptyRegistry.list()).length === 0, 'and the registry still answers')

console.log(failures === 0 ? '\nSKILLS CONTRACT OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
