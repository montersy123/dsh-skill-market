/**
 * What the panel is told when the skill market cannot be reached.
 *
 * The Host half owns the only address this plugin has (`UPSTREAM`), so an unreachable market is a Host
 * failure, and the panel can only say something useful if the Host says *which* failure it hit. Node
 * reports "refused", "did not resolve" and "answered too slowly" the same way at the top — a `TypeError`
 * reading `fetch failed`, with the useful part buried in the `cause` chain — and the panel used to print
 * that English line at the reader, under a Chinese title.
 *
 * This drives the real route handler with each kind of failure and checks the code it answers with, then
 * checks the client half maps those codes to the two sentences in `lib/locale.js`. The visual state
 * itself is exercised by pointing a running DSH at a dead port
 * (`DSH_SKILL_MARKET_UPSTREAM=http://127.0.0.1:9`).
 *
 *   node scripts/offline-check.mjs
 */
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Both overrides are set before the Host is imported: an assignment after `import` is hoisted away, and
// TEST_ONLY is what turns a missing scratch root into a loud failure instead of a write into the real
// profile. The skill root sits one level inside the scratch directory so the data root derived from it
// lands inside too.
const scratch = mkdtempSync(join(tmpdir(), 'skill-market-offline-'))
process.env.DSH_SKILL_MARKET_ROOT = join(scratch, 'skills')
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

/* ── the real Host, over a real server ─────────────────────────────────── */

let handler
const ctx = {
  logger: { debug() {}, warn() {} },
  effect(fn) {
    const disposer = fn()
    return typeof disposer === 'function' ? disposer : () => {}
  },
  webServer: { register(route) { handler = route.handler; return () => {} } },
  inject(names, callback) {
    const live = new Map()
    callback({
      ...ctx,
      skills: {
        async list() { return [...live.values()] },
        register(definition) { live.set(definition.name, definition); return () => live.delete(definition.name) },
      },
    })
  },
}

const mod = await import('../lib/index.js')
mod.apply(ctx)
if (typeof handler !== 'function') {
  console.error('  the Host registered no route handler')
  process.exit(1)
}
const server = createServer((req, res) => { void handler(req, res) })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${String(server.address().port)}`

/**
 * Ask the real route handler one question while `globalThis.fetch` fails the given way.
 *
 * The Host reads the upstream through the global `fetch`, so failing it fails every upstream read; the
 * call back into the server itself has to use the real implementation, which is why it is captured
 * first.
 *
 * @param {unknown} failure - What the upstream `fetch` should reject with.
 * @param {string} [path] - Route to ask.
 * @returns {Promise<{status: number, body: any}>} Status and parsed body.
 */
async function askWith(failure, path = '/skill-market/api/skills') {
  const real = globalThis.fetch
  globalThis.fetch = async () => { throw failure }
  try {
    const response = await real(`${origin}${path}`)
    return { status: response.status, body: await response.json() }
  } finally {
    globalThis.fetch = real
  }
}

/** A refused connection, as undici reports it. */
const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
/** A name that does not resolve — the classic "this machine is offline". */
const noDns = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
/** An expired `AbortSignal.timeout`, which every upstream read in the Host sets. */
const timedOut = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
/** A cancelled request is not a network story either, and must not be retold as one by accident. */
const aborted = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })
/** Anything else — a 500, a broken body, a bug in this plugin. */
const other = Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_INVALID_ARG' } })

console.log('the Host names the failure it hit')
const offline = await askWith(refused)
expect(offline.status === 502 && offline.body.code === 'offline',
  `a refused connection → 502 offline (got ${offline.status} ${String(offline.body.code)})`)
const dns = await askWith(noDns)
expect(dns.body.code === 'offline', `an unresolvable name → offline (got ${String(dns.body.code)})`)
const slow = await askWith(timedOut)
expect(slow.status === 504 && slow.body.code === 'timeout',
  `an expired timeout → 504 timeout (got ${slow.status} ${String(slow.body.code)})`)
const cancelled = await askWith(aborted)
expect(cancelled.body.code === 'timeout', `a cancelled read → timeout (got ${String(cancelled.body.code)})`)
const unknown = await askWith(other)
expect(unknown.status === 502 && unknown.body.code === 'upstream',
  `an unrecognised failure → 502 upstream (got ${unknown.status} ${String(unknown.body.code)})`)
// The raw reason stays in the payload: the panel is what chooses the sentence, and a developer looking
// at the response should still be able to see what Node said.
expect(typeof offline.body.error === 'string' && offline.body.error.includes('上游'),
  'the raw reason is still carried alongside the code')

// Every upstream read has its own handler, so one of them forgetting the code is the gap a check on a
// single route would miss. The file route has a 60-second timeout of its own, the category counts build
// on the category route, and the safety verdict is fetched per card.
for (const path of [
  '/skill-market/api/categories',
  '/skill-market/api/category-counts',
  '/skill-market/api/skill-security?slug=dev-expert&namespace=indiv-ebandao',
]) {
  const answer = await askWith(refused, path)
  expect(answer.body.code === 'offline', `${path} → offline (got ${answer.status} ${String(answer.body.code)})`)
}

// A refused request that is the caller's own fault must keep its 400 and gain no code: it is not a
// network story, and telling the reader to check their network would be wrong.
const bad = await askWith(refused, '/skill-market/api/skill-security')
expect(bad.status === 400 && bad.body.code === undefined,
  `a refused request of the panel\'s own making → 400 without a code (got ${bad.status} ${String(bad.body.code)})`)

console.log('\nthe panel turns those codes into sentences')
const client = readFileSync('lib/client.js', 'utf8')
expect(/body\?\.code === 'offline'[\s\S]{0,120}err\.offline/.test(client), "code 'offline' → the err.offline sentence")
expect(/body\?\.code === 'timeout'[\s\S]{0,120}err\.timeout/.test(client), "code 'timeout' → the err.timeout sentence")
expect(/catch \(error\) \{[\s\S]{0,200}AbortError[\s\S]{0,200}err\.offline/.test(client),
  'a Host that never answers → the same sentence, with AbortError left alone')

const locale = readFileSync('lib/locale.js', 'utf8')
for (const key of ["'err.offline'", "'err.timeout'"]) {
  const found = locale.split(key).length - 1
  expect(found === 2, `${key} is defined in both languages (found ${found})`)
}
for (const key of ['"err.offline"', '"err.timeout"']) {
  const found = client.split(key).length - 1
  expect(found === 2, `${key} reached the generated client block (found ${found})`)
}

server.close()
rmSync(scratch, { recursive: true, force: true })
console.log(`\n${failures === 0 ? 'OFFLINE OK' : `${String(failures)} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
