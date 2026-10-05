/**
 * The panel and the real Host half, over real HTTP.
 *
 * Every other client check stubs the Host, and `route-check.mjs` drives the routes with no panel —
 * so both halves are verified, but never against each other. That leaves the one failure a pair of
 * stubs cannot catch: a protocol mismatch. The client's path, method, body shape and the fields it
 * reads out of the answer all have to agree with what the Host actually serves, and the only way to
 * know is to put the two together.
 *
 * It is also the assertion this plugin's data location deserves: after a favorite is saved and a
 * skill is toggled, the state must be **on disk**, in the plugin's own data directory, in a file the
 * Host wrote — not anywhere in Web Storage.
 *
 * Runs entirely inside a scratch root.
 *
 *   node scripts/panel-live-check.mjs [--react <node_modules>]
 */
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const reactDir = process.argv[2] ?? 'scripts/dev/reactsmoke/node_modules'
const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)
const React = thirdPartyRequire('react')
const { JSDOM } = thirdPartyRequire('jsdom')

// Both overrides are set before the Host is imported: an assignment after `import` is hoisted away,
// and `TEST_ONLY` is what makes a missing scratch root fail loudly instead of writing to the real
// profile. This is the same guard the other checks use, and it exists because of a measured accident.
//
// The skill root is one level inside the scratch directory so that the data root the override
// derives (`<dirname>/skill-market-data`) lands inside it too: a scratch root directly under the
// temp directory would share `<tmp>/skill-market-data` with every other check that runs this way.
const scratch = mkdtempSync(join(tmpdir(), 'skill-market-live-'))
process.env.DSH_SKILL_MARKET_ROOT = join(scratch, 'skills')
process.env.DSH_SKILL_MARKET_TEST_ONLY = '1'

const skillsBody = readFileSync('tests/fixture/skills.json', 'utf8')
const categoriesBody = readFileSync('tests/fixture/categories.json', 'utf8')
const bundle = readFileSync('lib/client.js', 'utf8')

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

/* ── the real Host, over a real server ─────────────────────────────────── */

/**
 * The only transport in this process.
 *
 * It has two callers and they are told apart by their URLs: the panel asks for **relative** paths,
 * which go to the real Host over the real server, while the Host itself proxies its upstream reads
 * to `api.skillhub.cn`, which are answered from the captured fixture. Using one function for both is
 * deliberate — the Host and the panel live in the same process here, and a second `fetch` that the
 * Host did not use would silently take the network out of the picture for one of them.
 */
const nodeFetch = globalThis.fetch

/**
 * Answer one upstream read from the fixture.
 * @param {string} target - Upstream URL.
 * @returns {Promise<object>} A `fetch`-shaped response.
 */
async function upstream(target) {
  const url = new URL(target)
  const send = (body, status = 200) => ({
    ok: status === 200,
    status,
    async json() { return body },
    async text() { return JSON.stringify(body) },
  })
  if (url.pathname === '/api/v1/categories') return send(JSON.parse(categoriesBody))
  if (url.pathname.endsWith('/versions')) return send({ versions: [{ version: '2.0.3', changelog: '', createdAt: Date.now() }] })
  if (url.pathname.endsWith('/files')) return send({ count: 0, files: [] })
  // A detail read backs both the drawer and the per-card safety verdict.
  if (url.pathname.startsWith('/api/v1/skills/')) {
    return send({ skill: { summary_zh: '摘要' }, latestVersion: { version: '2.0.3' }, securityReports: {} })
  }
  // The list endpoint is `/api/skills`; the per-skill reads are under `/api/v1/skills`.
  if (url.pathname === '/api/skills' || url.pathname === '/api/v1/skills') return send(JSON.parse(skillsBody))
  return send({ error: `no fixture for ${url.pathname}` }, 404)
}

/**
 * Route one call to whichever side of this check owns it.
 * @param {string} url - Request target: a relative API path, or an absolute URL.
 * @param {object} init - Request init.
 * @returns {Promise<object>} The answer.
 */
const transport = async (url, init = {}) => {
  const target = String(url)
  if (target.startsWith('http')) {
    return target.startsWith('https://api.skillhub.cn') ? upstream(target) : nodeFetch(target, init)
  }
  const response = await nodeFetch(`${origin}${target}`, init)
  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    async json() { return JSON.parse(text) },
    async text() { return text },
  }
}

const mod = await import('../lib/index.js')

let handler
const ctx = {
  logger: { debug() {}, warn() {} },
  effect(fn) {
    const disposer = fn()
    return typeof disposer === 'function' ? disposer : () => {}
  },
  webServer: { register(route) { handler = route.handler; return () => {} } },
  inject(names, callback) {
    // A stand-in for the skill registry: the routes call `registry.sync()` after a write, and
    // `migrateLegacyRoot`/`scanInstalled` need nothing more than a catalogue to publish into.
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
mod.apply(ctx)
if (typeof handler !== 'function') {
  console.error('  the Host registered no route handler')
  process.exit(1)
}
const server = createServer((req, res) => { void handler(req, res) })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${String(server.address().port)}`

// One installed skill, written straight into the harness's own skill root, so `/installed` reports
// something real to toggle. Installing through the route would need the network, and what is being
// checked here is the state file, not the download.
const INSTALLED = 'indiv-ebandao--dev-expert'
mkdirSync(join(mod.installedSkillRoot(), INSTALLED), { recursive: true })
writeFileSync(join(mod.installedSkillRoot(), INSTALLED, 'SKILL.md'), '---\nname: dev-expert\ndescription: test\n---\n\nbody\n')

/**
 * Serve the panel's own relative API paths from the real Host.
 * @param {string} url - Request target.
 * @param {object} init - Request init.
 * @returns {Promise<object>} The Host's answer.
 */
const liveFetch = transport

/* ── the panel, in jsdom, against that server ───────────────────────────── */

/**
 * Mount the panel once and report what it did.
 *
 * @param {(window: object, act: Function, host: object) => Promise<object>} interact - What to do
 *   once it is mounted.
 * @returns {Promise<object>} Whatever the interaction reported.
 */
async function mount(interact) {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
    url: 'http://127.0.0.1:19387/',
    pretendToBeVisual: true,
  })
  const { window } = dom
  globalThis.window = window
  globalThis.document = window.document
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
  globalThis.HTMLElement = window.HTMLElement
  globalThis.Node = window.Node
  globalThis.Event = window.Event
  globalThis.MouseEvent = window.MouseEvent
  globalThis.KeyboardEvent = window.KeyboardEvent
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = thirdPartyRequire('react-dom/client')
  const { act } = thirdPartyRequire('react-dom/test-utils')

  window.fetch = liveFetch
  globalThis.fetch = liveFetch

  const registrations = []
  window.__ModuleLoader__ = { mode: 'queue', pendingQueue: registrations, load(r) { registrations.push(r) } }
  new Function('window', 'document', 'console', bundle)(window, window.document, console)

  const moduleExports = registrations[0].factory((specifier) => {
    if (specifier === 'react') return React
    throw new Error(`unsupported external: ${specifier}`)
  })
  const captured = []
  moduleExports.apply({
    get: () => undefined,
    provide: () => () => {},
    effect: (callback) => { const disposer = callback(); return () => { if (typeof disposer === 'function') disposer() } },
    on: () => () => {},
    slots: {
      inject: (key, callback) => callback(),
      register: (declaration, component) => { captured.push({ declaration, component }); return () => {} },
      registerFactory: () => () => {},
    },
  })

  const panelEntry = captured.find((entry) => entry.declaration.name === 'main')
  const host = window.document.getElementById('host')
  const root = createRoot(host)
  await act(async () => {
    root.render(React.createElement(panelEntry.component, {
      usePanelInfo: () => ({ getSnapshot: () => ({ activePanelId: 'skill-market' }) }),
    }))
  })
  for (let i = 0; i < 40; i += 1) await act(async () => { await settle() })

  const result = await interact(window, act, host)
  // Let the client's writes land before the window goes away. They are sent immediately, but the
  // request still has to complete — and `close()` takes the window's document, its `fetch` and its
  // timers with it, so this is the last moment the page can finish what it started.
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise((resolve) => { globalThis.setTimeout(resolve, 10) })
    })
  }
  await act(async () => { root.unmount() })
  window.close()
  return result
}

/** Open one view tab by its label. */
const openTab = async (window, act, host, label) => {
  const tab = Array.from(host.querySelectorAll('.sm-viewtab'))
    .find((element) => (element.textContent ?? '').startsWith(label))
  if (tab === undefined) return false
  await act(async () => {
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  for (let i = 0; i < 10; i += 1) await act(async () => { await settle() })
  return true
}

const stateFile = mod.panelStateFileForTest()
console.log('data directory  :', mod.pluginDataRootForTest())
console.log('state file      :', stateFile)

console.log('\n1) saving a favorite writes the file the Host owns')
expect(existsSync(stateFile) === false, 'nothing is stored before the panel is used')
const saved = await mount(async (window, act, host) => {
  const card = host.querySelector('.sm-skill-card .sm-save-btn')
  if (card === null) return { clicked: false }
  await act(async () => {
    card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    for (let i = 0; i < 20; i += 1) await settle()
  })
  await openTab(window, act, host, '收藏')
  return {
    clicked: true,
    rows: host.querySelectorAll('.sm-list-row').length,
    localStorageUsed: (() => {
      try { return window.localStorage.length } catch { return 'unavailable' }
    })(),
  }
})
console.log('  clicked         :', saved.clicked, '| saved rows:', saved.rows)
expect(saved.clicked, 'a card offers a save button')
expect(existsSync(stateFile), 'saving a favorite created the state file on disk')
const afterSave = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null
console.log('  saved           :', JSON.stringify(afterSave?.saved))
expect(Array.isArray(afterSave?.saved) && afterSave.saved.length === 1, 'and the favorite is in it')
expect(Object.keys(afterSave?.savedSkills ?? {}).length === 1, 'with the record that lets it render later')
expect(saved.localStorageUsed === 0, 'Web Storage was not written to at all')

console.log('\n2) a reload reads that file back, through the same route')
const reloaded = await mount(async (window, act, host) => {
  await openTab(window, act, host, '收藏')
  return { rows: host.querySelectorAll('.sm-list-row').length, name: host.querySelector('.sm-list-row h3')?.textContent ?? null }
})
console.log('  saved rows      :', reloaded.rows, '| first:', JSON.stringify(reloaded.name))
expect(reloaded.rows === 1, 'the favorite survives a reload of the page')
expect(reloaded.name !== null && reloaded.name !== '', 'and renders with its name, not an empty row')

console.log('\n3) toggling a skill records the restart advice against the running Host')
const toggled = await mount(async (window, act, host) => {
  await openTab(window, act, host, '已安装')
  const input = host.querySelector('.sm-list-row .sm-switch input')
  if (input !== null) {
    await act(async () => {
      input.click()
      for (let i = 0; i < 20; i += 1) await settle()
    })
  }
  return {
    found: input !== null,
    banner: host.querySelector('.sm-restart-banner')?.textContent ?? null,
  }
})
console.log('  switch found    :', toggled.found)
console.log('  banner          :', JSON.stringify((toggled.banner ?? '').slice(0, 60)))
const afterToggle = JSON.parse(readFileSync(stateFile, 'utf8'))
const answered = await (await fetch(`${origin}/skill-market/api/state`)).json()
console.log('  pending         :', JSON.stringify(afterToggle.pending))
expect(toggled.found, 'the installed skill offers a switch')
expect(toggled.banner !== null, 'toggling it raises the restart advice')
expect(Array.isArray(afterToggle.pending?.dirs) && afterToggle.pending.dirs.includes(INSTALLED),
  'the pending set on disk names the skill that changed')
expect(Number(afterToggle.pending?.since) === Number(answered.harnessStartedAt),
  'and is recorded against the start time the Host reports')

console.log('\n4) the advice survives a reload and is retired by a Host restart')
const second = await mount(async (window, act, host) => {
  await openTab(window, act, host, '已安装')
  return { banner: host.querySelector('.sm-restart-banner') !== null }
})
console.log('  advice after reload:', second.banner)
expect(second.banner, 'a reload of the page still advises the restart')

// A Host that started later is a Host that restarted, which is what the advice asked for. The real
// one cannot be restarted from here, so this is the one assertion made against a rewritten file
// rather than against a live event: the same document, with `since` moved into the past.
const stale = JSON.parse(readFileSync(stateFile, 'utf8'))
stale.pending = { since: Number(answered.harnessStartedAt) - 60_000, dirs: stale.pending.dirs }
writeFileSync(stateFile, `${JSON.stringify(stale, null, 2)}\n`)
const third = await mount(async (window, act, host) => {
  await openTab(window, act, host, '已安装')
  return { banner: host.querySelector('.sm-restart-banner') !== null }
})
console.log('  advice after restart:', third.banner)
expect(third.banner === false, 'an advice recorded before this Host started is not shown')
expect(JSON.parse(readFileSync(stateFile, 'utf8')).pending.dirs.length === 0,
  'and the stale payload is cleared from the file')

await new Promise((resolve) => {
  server.close(resolve)
  server.closeAllConnections?.()
})
rmSync(mod.installedSkillRoot(), { recursive: true, force: true })
rmSync(mod.pluginDataRootForTest(), { recursive: true, force: true })

console.log(failures === 0 ? '\nPANEL + HOST OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
