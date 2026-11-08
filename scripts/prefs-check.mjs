/**
 * Exercise the preference routes the settings page talks to.
 *
 * The switch in DSH's settings dialog is the only way to bring the sidebar entry back after hiding it,
 * so this route pair is the one place where a bad answer strands the user: a `GET` that 500s leaves the
 * sidebar hidden with no way to show it again, and a `POST` that half-applies leaves the page and the
 * sidebar disagreeing about what was saved.
 *
 * Both halves are checked here — the routes over real HTTP, and the sanitiser that decides what a
 * hand-edited file means — because the sanitiser is what makes "delete the file" and "write nonsense
 * into the file" recoverable at all.
 *
 * Runs entirely inside a scratch root.
 *
 *   node scripts/prefs-check.mjs
 */
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_SKILL_MARKET_ROOT = mkdtempSync(join(tmpdir(), 'skill-market-prefs-'))
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const mod = await import('../lib/index.js')

// Capture the registered route handler and drive it with a real server. `effect` runs its callback and
// keeps the disposer, like Cordis does — a stub that ignores it would register nothing and this test
// would pass vacuously.
let handler
const ctx = {
  logger: { debug() {}, warn() {} },
  effect(fn) {
    const disposer = fn()
    return disposer
  },
  webServer: {
    register(route) { handler = route.handler; return () => {} },
  },
  inject(names, callback) {
    // Cordis calls the callback with a scoped context once the services exist.
    callback({
      ...ctx,
      skills: {
        async list() { return [] },
        register() { return () => {} },
      },
    })
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
 * POST a body the way the settings page does.
 * @param {string} text - Body to send verbatim.
 * @returns {Promise<{status: number, body: any}>} Response.
 */
async function post(text) {
  const response = await fetch(`${base}/prefs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(text, 'utf8'),
  })
  let parsed
  try { parsed = await response.json() } catch { parsed = null }
  return { status: response.status, body: parsed }
}

/**
 * GET the preference document.
 * @returns {Promise<{status: number, body: any}>} Response.
 */
async function read() {
  const response = await fetch(`${base}/prefs`)
  let parsed
  try { parsed = await response.json() } catch { parsed = null }
  return { status: response.status, body: parsed }
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

const file = mod.prefsFileForTest()
/** Read the stored document, or null when there is no file. */
const stored = () => {
  if (existsSync(file) === false) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return undefined }
}

console.log('assertions:')

// 1. Nothing chosen yet: the entry shows, and the revision says there is nothing to compare against.
rmSync(file, { force: true })
const first = await read()
expect(first.status === 200 && first.body?.ok === true, 'a fresh install answers GET /prefs with ok')
expect(first.body?.prefs?.sidebarEntry === true, 'the sidebar entry defaults to shown, so the plugin is reachable')
expect(first.body?.revision === 0, 'no file means revision 0 rather than a made-up timestamp')

// 2. Turning it off lands on disk and comes back.
const off = await post(JSON.stringify({ sidebarEntry: false }))
expect(off.status === 200 && off.body?.prefs?.sidebarEntry === false, 'POST false stores the preference')
expect(stored()?.sidebarEntry === false, 'the file on disk says false')
expect(typeof off.body?.revision === 'number' && off.body.revision > 0, 'the write answers with a revision')
const afterOff = await read()
expect(afterOff.body?.prefs?.sidebarEntry === false, 'GET answers what was stored')
expect(afterOff.body?.revision === off.body.revision, 'GET reports the revision the write returned')

// 3. Turning it back on is the recovery path, so it has to work from the stored false.
const on = await post(JSON.stringify({ sidebarEntry: true }))
expect(on.body?.prefs?.sidebarEntry === true && stored()?.sidebarEntry === true, 'POST true turns it back on')

// 4. Bodies the page could send by mistake are refused as client errors, not as Host failures.
for (const [label, text] of [
  ['a string', JSON.stringify({ sidebarEntry: 'yes' })],
  ['a number', JSON.stringify({ sidebarEntry: 0 })],
  ['null', 'null'],
  ['an array', '[true]'],
  ['malformed JSON', '{"sidebarEntry":'],
]) {
  const refused = await post(text)
  expect(refused.status === 400, `POST with ${label} is refused as a 400`)
  expect(typeof refused.body?.error === 'string' && refused.body.error.length > 0,
    `the ${label} refusal carries a reason the page can show`)
}
expect(stored()?.sidebarEntry === true, 'a refused body leaves the stored preference alone')

// 5. A field this version does not know about is a no-op: answering 200 is right, bumping the revision
//    would wake every open page for nothing.
const mtimeBefore = readFileSync(file, 'utf8')
const unknown = await post(JSON.stringify({ theme: 'dark' }))
expect(unknown.status === 200, 'an unknown field is accepted rather than refused')
expect(unknown.body?.revision === 0, 'an unknown field answers revision 0, so nothing looks rewritten')
expect(readFileSync(file, 'utf8') === mtimeBefore, 'an unknown field does not rewrite the file')

// 6. A file someone edited by hand is not a crash. Nonsense means "defaults", the next save fixes it.
writeFileSync(file, '{not json', 'utf8')
const mangled = await read()
expect(mangled.status === 200 && mangled.body?.prefs?.sidebarEntry === true,
  'an unparseable file reads as the default instead of failing the settings page')

// 7. The sanitiser itself, which is what makes the above recoverable.
const sanitize = mod.sanitizePrefsForTest
expect(typeof sanitize === 'function', 'the Host exposes its sanitiser for testing')
expect(sanitize({ sidebarEntry: false }).sidebarEntry === false, 'only an explicit false hides the entry')
for (const value of [undefined, null, {}, [], 'no', 0, { sidebarEntry: 'false' }, { sidebarEntry: 0 }]) {
  expect(sanitize(value).sidebarEntry === true, `sanitising ${JSON.stringify(value) ?? 'undefined'} shows the entry`)
}

// 8. Overlapping saves: each answers 200 and the file that remains is one whole document.
rmSync(file, { force: true })
const overlapping = await Promise.all([false, true, false, true, false].map((value) => post(JSON.stringify({ sidebarEntry: value }))))
expect(overlapping.every((entry) => entry.status === 200), 'overlapping saves all answer 200')
const settled = stored()
expect(typeof settled?.sidebarEntry === 'boolean', 'overlapping saves leave one parseable document')
expect(existsSync(`${file}.tmp`) === false, 'no temporary file is left behind')

// 9. An empty object is the "nothing to do" body: still 200, still no write.
const empty = await post('{}')
expect(empty.status === 200 && empty.body?.revision === 0, 'an empty body is a no-op rather than a failure')

// The listening socket keeps the process alive, so the verdict has to shut it down first — otherwise a
// passing run looks like a hung one.
server.closeAllConnections?.()
await new Promise((resolve) => { server.close(resolve) })

console.log('')
if (failures.length > 0) {
  console.error(`PREFS FAILED (${String(failures.length)})`)
  for (const label of failures) console.error(`  ${label}`)
  process.exit(1)
}
console.log('PREFS OK')
