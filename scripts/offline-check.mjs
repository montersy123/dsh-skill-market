/**
 * What the panel shows when the market cannot be reached.
 *
 * The Host half owns the only address this plugin has, and when it cannot read the market it answers 502
 * carrying a Node message — `技能市场上游请求失败：fetch failed`. That text is what the panel used to put
 * in front of the reader. It now answers that status with a sentence of its own, and a Host that does not
 * answer at all (a restart, a dropped page connection) gets the same sentence instead of the browser's
 * `TypeError: Failed to fetch`.
 *
 * Two halves have to hold for that: the Host must keep answering 502 when the market is unreachable, and
 * the client must keep turning 502/504 — and a dead connection — into `err.offline`. The rendered state
 * itself is exercised by hand: point `UPSTREAM` in `lib/index.js` at a port nothing listens on, restart
 * DSH, and look at the panel.
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
 * The Host reads the upstream through the global `fetch`, so failing it fails every upstream read. The
 * call back into the server itself has to use the real implementation, which is why it is captured first.
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

console.log('the Host answers 502 when it cannot read the market')
for (const [label, failure] of [['a refused connection', refused], ['an unresolvable name', noDns], ['an expired timeout', timedOut]]) {
  const answer = await askWith(failure)
  expect(answer.status === 502, `${label} → 502 (got ${answer.status})`)
  // The Node text stays in the payload. That is the point: the panel chooses the sentence, and the
  // response stays useful to whoever is reading responses rather than screens.
  expect(typeof answer.body.error === 'string' && answer.body.error.length > 0, `${label} → the reason is still carried`)
}

// Every upstream read has its own handler, and a status that is not 502 is a status the panel passes
// through as-is — so each of them has to be the one the panel keys on.
for (const path of [
  '/skill-market/api/categories',
  '/skill-market/api/category-counts',
  '/skill-market/api/skill-security?slug=dev-expert&namespace=indiv-ebandao',
]) {
  const answer = await askWith(refused, path)
  expect(answer.status === 502, `${path} → 502 (got ${answer.status})`)
}

// A refused request that is the caller's own fault stays a 400. Telling that reader to check their
// network would be wrong, so it must not look like the case above.
const bad = await askWith(refused, '/skill-market/api/skill-security')
expect(bad.status === 400, `a refused request of the panel's own making → 400 (got ${bad.status})`)

console.log('\nthe panel turns that status into a sentence')
const client = readFileSync('lib/client.js', 'utf8')
expect(/status === 502 \|\| status === 504[\s\S]{0,120}err\.offline/.test(client),
  'a 502/504 from the proxy → the err.offline sentence')
expect(/catch \(error\) \{[\s\S]{0,200}AbortError[\s\S]{0,200}err\.offline/.test(client),
  'a Host that never answers → the same sentence, with AbortError left alone')

const locale = readFileSync('lib/locale.js', 'utf8')
const found = locale.split("'err.offline'").length - 1
expect(found === 2, `err.offline is defined in both languages (found ${found})`)
expect(client.split('"err.offline"').length - 1 === 2, 'err.offline reached the generated client block')

server.close()
rmSync(scratch, { recursive: true, force: true })
console.log(`\n${failures === 0 ? 'OFFLINE OK' : `${String(failures)} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
