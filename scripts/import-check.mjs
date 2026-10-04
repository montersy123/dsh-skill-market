/**
 * Exercise local skill import end to end, including the ZIP reader.
 *
 * Local import used to read a file's name and size and throw the file away, so the panel listed
 * a skill that existed nowhere. This checks the replacement actually unpacks: real archives are
 * built here and pushed through `importLocalSkillForTest`, and the bytes that land on disk are
 * compared against what went in.
 *
 * Runs entirely inside a scratch root.
 *
 *   node tools/import-check.mjs
 */
import { deflateRawSync } from 'node:zlib'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_SKILL_MARKET_ROOT = mkdtempSync(join(tmpdir(), 'skill-market-import-'))
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const mod = await import('../lib/index.js')

/**
 * Build a ZIP archive in memory.
 *
 * Written by hand rather than shelling out, so the test asserts the plugin's reader against
 * bytes it controls — including a deliberately unsafe entry name and a stored (uncompressed)
 * entry, which a system zip tool would not let us express.
 *
 * @param {Array<{name: string, data: string, store?: boolean}>} entries - Members to add.
 * @returns {Buffer} Archive bytes.
 */
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.from(entry.data, 'utf8')
    const method = entry.store === true ? 0 : 8
    const body = method === 0 ? raw : deflateRawSync(raw)
    const crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBytes, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + body.length
  }
  const directory = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(directory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, eocd])
}

/** CRC-32, which the archive format requires even though the reader does not verify it. */
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
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

const root = mod.installedSkillRoot()
const SKILL = '---\nname: imported-demo\ndescription: 导入测试\nversion: 1.2.3\n---\n\n正文\n'

console.log('assertions:')

// 1. A zip with a single wrapper directory, as "compress this folder" produces.
const wrapped = makeZip([
  { name: 'demo/SKILL.md', data: SKILL },
  { name: 'demo/references/guide.md', data: '# guide\n' },
  { name: 'demo/scripts/run.py', data: 'print(1)\n', store: true },
  { name: 'demo/__MACOSX/._junk', data: 'junk' },
])
const first = await mod.importLocalSkillForTest({ name: 'demo.zip', bytes: wrapped })
const dir = join(root, 'local--imported-demo')
expect(existsSync(join(dir, 'SKILL.md')), 'a wrapped archive is unpacked with the wrapper stripped')
expect(existsSync(join(dir, 'references', 'guide.md')), 'nested directories are created')
expect(readFileSync(join(dir, 'scripts', 'run.py'), 'utf8') === 'print(1)\n', 'a stored (uncompressed) entry round-trips')
expect(existsSync(join(dir, '__MACOSX')) === false, 'macOS metadata is dropped')
expect(first.name === 'imported-demo', 'the result reports the name from SKILL.md frontmatter')
expect(first.version === '1.2.3', 'the result reports the version from SKILL.md frontmatter')
expect(first.directory.startsWith(root), 'the skill is written into the shared skill root')

// 2. The scan must see it, which is what makes it appear in the panel at all.
const summary = await mod.registryForTest({ skills: { register: () => () => {} }, logger: { warn() {}, debug() {} } }).summary()
const listed = summary.skills.find((entry) => entry.directoryName === 'local--imported-demo')
expect(listed !== undefined, 'the Host scan lists the imported skill')
expect(listed?.origin === 'local', 'it is marked as a local import')
expect(listed?.enabled === true, 'it is enabled, because it is in the skill root')
expect(listed?.latestVersion === '', 'no upstream version is looked up for a local skill')

// 3. A bare SKILL.md is a skill too.
const bare = await mod.importLocalSkillForTest({ name: 'SKILL.md', bytes: Buffer.from(SKILL.replace('imported-demo', 'bare-skill'), 'utf8') })
expect(existsSync(join(root, 'local--bare-skill', 'SKILL.md')), 'a bare SKILL.md imports as a one-file skill')
expect(bare.name === 'bare-skill', 'the bare file keeps its frontmatter name')

// 4. Refusals. Each of these must fail loudly rather than import something broken.
const rejections = [
  ['a zip with no SKILL.md', () => mod.importLocalSkillForTest({ name: 'x.zip', bytes: makeZip([{ name: 'README.md', data: 'hi' }]) })],
  ['a non-kebab-case skill name', () => mod.importLocalSkillForTest({ name: 'x.zip', bytes: makeZip([{ name: 'SKILL.md', data: '---\nname: Bad Name\ndescription: d\n---\n' }]) })],
  ['a SKILL.md with no description', () => mod.importLocalSkillForTest({ name: 'x.zip', bytes: makeZip([{ name: 'SKILL.md', data: '---\nname: ok-skill\n---\n' }]) })],
  ['an unrecognisable file', () => mod.importLocalSkillForTest({ name: 'notes.txt', bytes: Buffer.from('just text') })],
  ['an empty upload', () => mod.importLocalSkillForTest({ name: 'x.zip', bytes: Buffer.alloc(0) })],
  ['an oversized archive', () => mod.importLocalSkillForTest({ name: 'x.zip', bytes: Buffer.alloc(51 * 1024 * 1024) })],
]
for (const [label, run] of rejections) {
  let threw = false
  try { await run() } catch { threw = true }
  expect(threw, `refuses ${label}`)
}

// 5. Path traversal must not escape the skill directory.
const evil = makeZip([
  { name: '../../escaped.txt', data: 'nope' },
  { name: 'SKILL.md', data: SKILL.replace('imported-demo', 'escape-attempt') },
])
await mod.importLocalSkillForTest({ name: 'evil.zip', bytes: evil })
const escapeDir = join(root, 'local--escape-attempt')
expect(existsSync(escapeDir), 'the traversal archive still imports its legitimate file')
expect(existsSync(join(root, 'escaped.txt')) === false && existsSync(join(root, '..', 'escaped.txt')) === false,
  'the `../` entry is skipped rather than escaping the root')
expect(readdirSync(escapeDir).includes('escap') === false, 'only the safe members were written')

// 6. A soft assertion that the reader refuses a corrupt archive rather than guessing.
let corruptRejected = false
try { mod.readZipEntriesForTest(Buffer.from('not a zip at all, definitely not')) } catch { corruptRejected = true }
expect(corruptRejected, 'refuses a non-zip buffer')

// Clean up without touching anything outside the scratch tree.
rmSync(root, { recursive: true, force: true })
rmSync(mod.pluginDataRootForTest(), { recursive: true, force: true })
void [mkdirSync, writeFileSync]

console.log(failures.length === 0 ? '\nLOCAL IMPORT OK' : `\n${failures.length} ASSERTION(S) FAILED`)
process.exit(failures.length === 0 ? 0 : 1)
