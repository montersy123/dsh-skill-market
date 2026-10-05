/**
 * Exercise the plugin's HTTP routes through a real server.
 *
 * `import-check.mjs` calls the import function directly, which leaves the route — the boundary
 * the browser actually talks to — untested. This drives the registered handler over real HTTP,
 * so the request shape the client sends (raw bytes, filename in the query, octet-stream content
 * type) is verified end to end rather than assumed.
 *
 * The route handler is a plain Node request listener (`@deepseek-ai/dsh-host-webserver` passes
 * `(req, res)` straight through), so a bare `createServer` is enough to stand in for the host.
 *
 * Runs entirely inside a scratch root.
 *
 *   node tools/route-check.mjs
 */
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { deflateRawSync } from 'node:zlib'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'

process.env.DSH_SKILL_MARKET_ROOT = mkdtempSync(join(tmpdir(), 'skill-market-route-'))
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const mod = await import('../lib/index.js')

/** CRC-32, which the archive format carries even though the reader does not verify it. */
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Build a single-member ZIP archive in memory.
 * @param {Array<{name: string, data: string}>} entries - Members.
 * @returns {Buffer} Archive bytes.
 */
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.from(entry.data, 'utf8')
    const body = deflateRawSync(raw)
    const crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, body)
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

// Capture the registered route handler and drive it with a real server. `effect` runs its
// callback and keeps the disposer, like Cordis does — a stub that ignores it would register
// nothing and this test would pass vacuously.
let handler
const disposers = []
/**
 * A stand-in for the harness's skill registry.
 *
 * The routes call `registry.sync()` after a write, so the plugin needs *something* on
 * `ctx.skills`: without it the write succeeds and the response is a 500, which is a confusing
 * failure to debug from the outside. Only the two methods the plugin uses are provided.
 */
function makeSkillsStub() {
  const live = new Map()
  return {
    async list() { return [...live.values()] },
    register(definition) {
      live.set(definition.name, definition)
      return () => live.delete(definition.name)
    },
  }
}
const ctx = {
  logger: { debug() {}, warn() {} },
  effect(fn) {
    const disposer = fn()
    if (typeof disposer === 'function') disposers.push(disposer)
    return disposer
  },
  webServer: {
    register(route) { handler = route.handler; return () => {} },
  },
  inject(names, callback) {
    // Cordis calls the callback with a scoped context once the services exist.
    const scoped = { ...ctx, skills: makeSkillsStub() }
    callback(scoped)
  },
}
mod.apply(ctx)
if (typeof handler !== 'function') {
  console.error('route handler was not registered')
  process.exit(1)
}

const server = createServer((req, res) => { void handler(req, res) })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/skill-market/api`

/**
 * POST a body the way the client does.
 * @param {string} path - Route suffix plus query.
 * @param {Buffer} body - Raw bytes.
 * @param {string} contentType - Request content type.
 * @returns {Promise<{status: number, body: any}>} Response.
 */
async function post(path, body, contentType) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
  let parsed
  try { parsed = await response.json() } catch { parsed = null }
  return { status: response.status, body: parsed }
}

/**
 * Send raw request headers and read whatever comes back, without `fetch`.
 *
 * Exists for one case: a request whose declared body is larger than the ceiling. The Host refuses
 * it from its headers, so the response overlaps an upload the client then abandons, and `fetch`
 * reports the resulting TCP reset instead of the 400. Reading the bytes off a socket is the only
 * way to observe the status the Host actually sent.
 *
 * @param {string} headers - Complete request head, ending with a blank line.
 * @returns {Promise<string>} Everything the server sent, as text.
 */
function rawRequest(headers) {
  return new Promise((resolve, reject) => {
    const socket = connect(server.address().port, '127.0.0.1', () => { socket.write(headers) })
    let text = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => { text += chunk })
    socket.on('end', () => resolve(text))
    socket.on('close', () => resolve(text))
    socket.on('error', reject)
  })
}

const failures = []
/**
 * Record one assertion.
 * @param {boolean} condition - What must hold.
 * @param {string} label - Description.
 */
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures.push(label)
}

const root = mod.installedSkillRoot()
const SKILL = '---\nname: routed-skill\ndescription: 路由测试\n---\n\n正文\n'

console.log('assertions:')

// 1. The import route, exactly as the client calls it: bytes in the body, name in the query.
const ok = await post(`/import?name=${encodeURIComponent('demo.zip')}`, makeZip([
  { name: 'SKILL.md', data: SKILL },
  { name: 'references/a.md', data: 'a\n' },
]), 'application/octet-stream')
expect(ok.status === 200 && ok.body?.ok === true, 'the import route answers 200 with ok')
if (ok.status !== 200) console.log('    import answered:', ok.status, JSON.stringify(ok.body))
expect(ok.body?.import?.name === 'routed-skill', 'the response carries the imported skill name')
expect(existsSync(join(root, 'local--routed-skill', 'SKILL.md')), 'the file landed in the skill root via HTTP')
expect(Array.isArray(ok.body?.installed?.skills), 'the response includes the refreshed skill list')
const listed = (ok.body?.installed?.skills ?? []).find((entry) => entry.directoryName === 'local--routed-skill')
expect(listed?.origin === 'local', 'the refreshed list marks it as a local import')

// 2. A refused package must come back as an error the client can show, not a 200.
const bad = await post(`/import?name=${encodeURIComponent('bad.zip')}`, makeZip([
  { name: 'SKILL.md', data: '---\nname: no-description\n---\n' },
]), 'application/octet-stream')
expect(bad.status >= 400, 'an invalid package is refused rather than silently accepted')
expect(typeof bad.body?.error === 'string' && bad.body.error.length > 0, 'the refusal carries a human-readable reason')

// 3. An empty body is refused.
const empty = await post(`/import?name=x.zip`, Buffer.alloc(0), 'application/octet-stream')
expect(empty.status >= 400, 'an empty upload is refused')

// 4. The read routes still work over the same handler.
const installed = await fetch(`${base}/installed`)
const installedBody = await installed.json()
expect(installed.status === 200, 'the installed route answers 200')
expect(Array.isArray(installedBody?.skills), 'the installed route reports a skill list')
expect(installedBody.skills.some((entry) => entry.directoryName === 'local--routed-skill'),
  'the skill imported over HTTP appears in the installed route')

// 5. Unknown routes are 404 rather than a hang or an empty 200.
const unknown = await fetch(`${base}/nope`)
expect(unknown.status === 404, 'an unknown route answers 404')

// 6. Enabling and disabling over HTTP, the other write the panel performs.
const toggle = await post('/enabled', Buffer.from(JSON.stringify({ directory: 'local--routed-skill', enabled: false })), 'application/json')
expect(toggle.status === 200, 'the enabled route answers 200')
expect(existsSync(join(mod.disabledRootForTest(), 'local--routed-skill')), 'disabling moved the imported skill to the store')
const toggleBack = await post('/enabled', Buffer.from(JSON.stringify({ directory: 'local--routed-skill', enabled: true })), 'application/json')
expect(toggleBack.status === 200 && existsSync(join(root, 'local--routed-skill')), 'enabling moved it back')

// 7. The safety verdict, which decides whether the 安全 badge may appear.
//
// Two things are being pinned here. First, the rule itself: only an all-benign scan counts as safe,
// because vendors disagree in practice (`ima-skills` is benign from one and suspicious from the
// other) and a badge drawn from "at least one said safe" would claim something nobody said. Second,
// that the route exists and answers in the compact shape the cards need — the reports live only in
// the 2.3 KB detail response, which is too much to pull once per card.
const safetyVerdict = mod.safetyVerdictForTest
expect(typeof safetyVerdict === 'function', 'the Host exposes its safety verdict for testing')

expect(safetyVerdict({ keen: { status: 'benign' }, sanbu: { status: 'benign' } }).verdict === 'safe',
  'every vendor benign is safe')
expect(safetyVerdict({ keen: { status: 'benign' }, sanbu: { status: 'suspicious' } }).verdict === 'risk',
  'one suspicious vendor makes the whole skill not safe, however the other voted')
expect(safetyVerdict({ keen: { status: 'queued' }, sanbu: { status: 'queued' } }).verdict === 'pending',
  'a queued scan is pending rather than safe')
expect(safetyVerdict({ keen: { status: 'benign' }, sanbu: { status: 'queued' } }).verdict === 'pending',
  'benign plus queued is still pending, not safe')
expect(safetyVerdict({}).verdict === 'unknown', 'no reports is unknown')
expect(safetyVerdict(undefined).verdict === 'unknown', 'a missing field is unknown, not an error')
expect(safetyVerdict(null).verdict === 'unknown', 'null is unknown')
expect(safetyVerdict({ keen: { status: 'suspicious' }, sanbu: { status: 'queued' } }).verdict === 'risk',
  'risk outranks pending')
const withText = safetyVerdict({
  keen: { status: 'benign', statusText: '安全，无风险', reportUrl: 'https://example.test/report' },
})
expect(withText.vendors.length === 1 && withText.vendors[0].statusText === '安全，无风险'
  && withText.vendors[0].reportUrl === 'https://example.test/report',
  'the per-vendor text and report link are carried through for the drawer')

// The route answers at all, and rejects a bad namespace rather than proxying it.
const securityBad = await fetch(`${base}/skill-security?slug=dev-expert&namespace=../etc`)
expect(securityBad.status === 400, 'the security route validates the namespace like the others')

// 8. A bundle whose declared name the registry would refuse must fail at INSTALL time.
//
// The registry validates `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` when a skill is *loaded*, so a
// package saying `name: Playwright (Automation + MCP + Scraper)` used to install cleanly, take up a
// directory, and then never appear in any conversation. This is a real publisher defect on SkillHub,
// not a hypothetical: several skills under one namespace declare a Chinese display name.
//
// One live install is used because the check's whole value is that the grammar is applied to bytes
// that actually arrived from upstream — a unit test of the pattern would not prove it is wired in.
const assertSkillName = mod.assertSkillNameForTest
expect(typeof assertSkillName === 'function', 'the Host exposes its name guard for testing')
for (const good of ['dev-expert', 'a', 'a1-b2', 'playwright-stealth']) {
  let accepted = true
  try { assertSkillName(good) } catch { accepted = false }
  expect(accepted, `a valid kebab-case name is accepted: ${good}`)
}
for (const bad of ['Playwright (Automation + MCP + Scraper)', 'Playwright MCP 浏览器自动化', 'a--b', 'A-B', '-a', 'a-', 'a b', '技能']) {
  let refused = false
  try { assertSkillName(bad) } catch { refused = true }
  expect(refused, `a name the registry would refuse is refused: ${JSON.stringify(bad)}`)
}

const badBundle = await post('/install', Buffer.from(JSON.stringify({
  slug: 'playwright-mcp-browser-automation',
  namespace: 'user_3c6cb52e',
  name: '',
  version: '',
})), 'application/json')
expect(badBundle.status >= 400,
  'installing a bundle with a non-kebab-case name fails rather than succeeding silently')
expect(String(badBundle.body?.error ?? '').includes('kebab-case'),
  'and the refusal names the grammar, so the publisher\'s mistake is visible')
expect(existsSync(join(root, 'user-3c6cb52e--playwright-mcp-browser-automation')) === false,
  'and nothing was left on disk for a bundle that could never load')

// 10. The panel's own state document. This route is the whole persistence story of the browser
//     half: it used to be `localStorage` — which on the desktop is DSH's own LevelDB, shared with
//     every other plugin and addressed by origin rather than by plugin — and it is now one file in
//     this plugin's data directory. The assertions therefore cover both halves of that claim: the
//     route round-trips a document, and it lands at the path the plugin is supposed to own.
const emptyState = await fetch(`${base}/state`)
const emptyBody = await emptyState.json()
expect(emptyState.status === 200, 'the state route answers 200 before anything has been stored')
expect(emptyBody?.state === null, 'an absent document is reported as null rather than as an empty one')
expect(Number.isFinite(Number(emptyBody?.harnessStartedAt)) && Number(emptyBody.harnessStartedAt) > 0,
  'the response carries the Host process start time, which is what retires the restart advice')
expect(Number(emptyBody?.revision) === 0, 'and no revision, because no document has been written yet')

const panelDocument = {
  category: 'dev-programming',
  installed: [{ id: '@indiv-ebandao/dev-expert', installedAt: 1_700_000_000_000, directoryName: 'indiv-ebandao--dev-expert' }],
  saved: ['@indiv-ebandao/dev-expert'],
  savedSkills: { '@indiv-ebandao/dev-expert': { id: '@indiv-ebandao/dev-expert', name: '编程专家' } },
  enabled: { 'indiv-ebandao--dev-expert': true },
  pending: { since: 1_700_000_000_000, dirs: ['indiv-ebandao--dev-expert'] },
}
const wrote = await post('/state', Buffer.from(JSON.stringify(panelDocument)), 'application/json')
expect(wrote.status === 200 && wrote.body?.ok === true, 'the state route accepts a document')
expect(Number(wrote.body?.revision) > 0, 'and reports the revision it landed as')

const stateFile = mod.panelStateFileForTest()
expect(stateFile === join(mod.pluginDataRootForTest(), 'panel.json'),
  'the document lives in the plugin data directory, beside the disabled store and install record')
expect(existsSync(stateFile), 'and the write really put a file there')
expect(resolve(stateFile).startsWith(resolve(mod.pluginDataRootForTest()) + sep),
  'inside the plugin\'s own directory rather than anywhere else')
const onDisk = JSON.parse(readFileSync(stateFile, 'utf8'))
expect(onDisk.saved?.length === 1 && onDisk.savedSkills?.['@indiv-ebandao/dev-expert']?.name === '编程专家',
  'the stored document is readable JSON with the favorites and their records intact')
expect(onDisk.category === 'dev-programming', 'and the category preference with them')

const reread = await fetch(`${base}/state`)
const rereadBody = await reread.json()
expect(rereadBody?.state?.saved?.[0] === '@indiv-ebandao/dev-expert', 'a later read returns what was written')
expect(Number(rereadBody?.revision) === Number(wrote.body?.revision),
  'with the same revision, so a client can tell "unchanged" from "another window wrote"')

// A body that is not a document must be refused rather than stored: the panel parses this file on
// every load, and an array or a string would take the whole panel down with it.
const notADocument = await post('/state', Buffer.from(JSON.stringify(['not', 'a', 'document'])), 'application/json')
expect(notADocument.status === 400, 'a body that is not a JSON object is refused as the caller\'s fault')
expect(JSON.parse(readFileSync(stateFile, 'utf8')).saved?.length === 1, 'and the stored document is left alone')

// The ceiling is the caller's fault too. It cannot be checked through `fetch`: a server that
// refuses a 5 MB body without reading it resets the connection while the client is still uploading,
// and the reset is what `fetch` reports — the response, correct as it is, arrives tangled with an
// abort. So the case is pinned from one layer down: the headers of an oversized request are sent
// and the body never is, which is exactly the shape being refused.
const oversized = await rawRequest(
  `POST /skill-market/api/state HTTP/1.1\r\n`
  + `Host: 127.0.0.1:${String(server.address().port)}\r\n`
  + 'Content-Type: application/json\r\n'
  + `Content-Length: ${String(5 * 1024 * 1024)}\r\n`
  + '\r\n',
)
expect(oversized.startsWith('HTTP/1.1 400'), 'a document larger than the ceiling is refused before it is read')
expect(JSON.parse(readFileSync(stateFile, 'utf8')).saved?.length === 1, 'and leaves the previous document in place')

// 11. The upstream namespace survives an install, even when it contains characters the directory
//    name cannot hold.
//
// `safeSegment` rewrites `_` to `-`, so a skill published under `user_814dbe54` lands in
// `user-814dbe54--github`. Reconstructing the namespace by splitting that directory name asked
// upstream for `user-814dbe54`, which does not exist: every detail request 404'd, and the drawer
// simply never loaded. The identity is now recorded, and older records are repaired by asking the
// catalogue — with an injected transport, so this asserts the repair without needing the network.
const repairInstallIdentity = mod.repairInstallIdentityForTest
expect(typeof repairInstallIdentity === 'function', 'the Host exposes the identity repair for testing')

// Seed exactly the shape an older build wrote: version and time, no identity.
const identitySeed = join(mod.pluginDataRootForTest(), 'installed.json')
mkdirSync(dirname(identitySeed), { recursive: true })
writeFileSync(identitySeed, JSON.stringify({
  'user-814dbe54--github': { version: '1.0.0', at: 1 },
}, null, 2))

// Probes find nothing, so the catalogue search is the only way — which is what this case covers. It is
// the last resort precisely because its ranking can hide a skill; the probe case below is the reliable
// path, and the one real records actually take.
const fakeCatalogue = async (url) => {
  if (String(url).includes('/api/v1/skills/')) {
    return { ok: false, status: 404, async json() { return {} } }
  }
  return {
    ok: true,
    status: 200,
    async json() {
      return { data: { skills: [{ slug: 'github', namespace: { handle: 'user_814dbe54' } }] } }
    },
  }
}
const repaired = await repairInstallIdentity(fakeCatalogue)
expect(repaired.repaired.length === 1, 'a record with no namespace is repaired')
const repairedRecord = JSON.parse(readFileSync(identitySeed, 'utf8'))
expect(repairedRecord['user-814dbe54--github']?.namespace === 'user_814dbe54',
  'and it gains the upstream namespace, underscores intact')
expect(repairedRecord['user-814dbe54--github']?.slug === 'github', 'along with the slug')
expect(repairedRecord['user-814dbe54--github']?.version === '1.0.0',
  'without losing the release it already knew')

// The probe order matters, and the first candidate that answers wins: probing the detail endpoint has
// no ranking to lose to, unlike the catalogue search this originally used — which silently failed on
// a real record because the skill did not appear in the first 20 results for its own slug.
writeFileSync(identitySeed, JSON.stringify({ 'clawhub-root--find-skills': { version: '1.0.0', at: 1 } }, null, 2))
const probed = []
const probeFetch = async (url) => {
  probed.push(String(url))
  // Only the underscore spelling exists, which is the real shape for this namespace.
  const exists = String(url).includes('namespace=clawhub_root')
  return { ok: exists, status: exists ? 200 : 404, async json() { return {} } }
}
const probedOutcome = await repairInstallIdentity(probeFetch)
expect(probedOutcome.repaired.length === 1, 'a namespace differing only by `_` vs `-` is recovered by probing')
expect(JSON.parse(readFileSync(identitySeed, 'utf8'))['clawhub-root--find-skills']?.namespace === 'clawhub_root',
  'and the underscore spelling is the one recorded')
expect(probed.every((url) => url.includes('/api/v1/skills/')),
  'the probe asks the detail endpoint rather than a ranked search')

// A second pass must be a no-op rather than another round of requests.
let secondPassCalls = 0
const countedFetch = async (url) => { secondPassCalls += 1; return fakeCatalogue(url) }
const again = await repairInstallIdentity(countedFetch)
expect(again.repaired.length === 0 && secondPassCalls === 0,
  'a record that already has its namespace is left alone, with no request made')

// And a record whose slug nothing publishes is left as it was rather than filled with a guess.
writeFileSync(identitySeed, JSON.stringify({
  'user-814dbe54--github': { version: '1.0.0', at: 1 },
  'ghost-publisher--no-such-skill': { version: '1.0.0', at: 1 },
}, null, 2))
const partial = await repairInstallIdentity(fakeCatalogue)
expect(partial.unresolved.includes('ghost-publisher--no-such-skill'), 'an unresolvable record is reported')
expect(JSON.parse(readFileSync(identitySeed, 'utf8'))['ghost-publisher--no-such-skill']?.namespace === undefined,
  'and is left without an invented namespace')

await new Promise((resolve) => {
  server.close(resolve)
  // `server.close()` waits for every open connection, and the oversized request above leaves one
  // that was never read to the end. The check is over, so those sockets are dropped rather than
  // waited out — the Host's own answer to that case is asserted above, not here.
  server.closeAllConnections?.()
})
rmSync(root, { recursive: true, force: true })
rmSync(mod.pluginDataRootForTest(), { recursive: true, force: true })

console.log(failures.length === 0 ? '\nROUTES OK' : `\n${failures.length} ASSERTION(S) FAILED`)
process.exit(failures.length === 0 ? 0 : 1)
