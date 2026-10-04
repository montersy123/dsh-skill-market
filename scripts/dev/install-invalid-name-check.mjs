/**
 * Install one upstream skill into a scratch root and report what the harness would make of it.
 *
 * Answers a specific question: when a publisher's `SKILL.md` carries a non-kebab-case `name`, does the
 * *install* fail, or does the install succeed and the skill simply never register? The two need
 * different fixes, and the card's error message does not say which happened.
 *
 * Never touches the real skill root: `DSH_SKILL_MARKET_TEST_ONLY=1` makes the plugin throw unless
 * `DSH_SKILL_MARKET_ROOT` is set, and it is set here.
 *
 *   node scripts/install-invalid-name-check.mjs <slug> <namespace>
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const slug = process.argv[2] ?? 'playwright-mcp-browser-automation'
const namespace = process.argv[3] ?? 'user_3c6cb52e'

const scratch = mkdtempSync(join(tmpdir(), 'dsh-invalid-name-'))
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'
process.env.DSH_SKILL_MARKET_ROOT = scratch

const mod = await import('@montersy123/dsh-skill-market')
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

console.log(`  scratch root: ${scratch}`)
console.log(`  resolved     : ${mod.installedSkillRoot?.() ?? '(n/a)'}`)
console.log('')

let installed
try {
  installed = await mod.installSkillForTest({ slug, namespace, name: '', version: '' })
  console.log('  install result: SUCCESS')
  console.log('    directory:', installed.directory)
  console.log('    files    :', installed.files)
} catch (error) {
  console.log('  install result: FAILED —', error.message)
  rmSync(scratch, { recursive: true, force: true })
  process.exit(0)
}

const skillMd = join(installed.directory, 'SKILL.md')
if (existsSync(skillMd) === false) {
  console.log('  SKILL.md   : MISSING after install')
} else {
  const text = readFileSync(skillMd, 'utf8')
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const line = block === null ? null : /^name:\s*(.*)$/m.exec(block[1])
  const declared = line === null ? '' : line[1].trim().replace(/^["']|["']$/g, '')
  console.log('  SKILL.md   : present')
  console.log('    declared name :', JSON.stringify(declared))
  console.log('    kebab-case    :', SKILL_NAME.test(declared))
  console.log('    directory name:', installed.directory.split(/[\\/]/).pop())
}

// And what the registry reports for it — the same shape the panel's list is built from.
const summary = await mod.registryForTest({
  skills: { register: () => () => {} },
  logger: { warn() {}, debug() {} },
}).summary()
console.log('')
console.log('  summary rows:', summary.skills.length)
for (const row of summary.skills) {
  console.log(`    ${row.directoryName}  name=${JSON.stringify(row.name)}  origin=${row.origin}`)
}

rmSync(scratch, { recursive: true, force: true })
rmSync(mod.pluginDataRootForTest(), { recursive: true, force: true })
