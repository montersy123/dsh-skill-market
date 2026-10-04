/**
 * Two legacy-store cases, both from the build that persisted ids without records.
 *
 * The product decision is to discard data that cannot be resolved rather than
 * migrate it, so the expectations are the opposite of a rescue: the page must not
 * crash, must show what it can still resolve, and must prune the ids that can never
 * be resolved instead of keeping entries that will never render.
 *
 *   node tools/legacy-saved-check.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const reactDir = process.argv[2] ?? 'scripts/dev/reactsmoke/node_modules'
const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)
const React = thirdPartyRequire('react')
const { JSDOM } = thirdPartyRequire('jsdom')

const fixtureDir = 'tests/fixture'
const skillsBody = readFileSync(join(fixtureDir, 'skills.json'), 'utf8')
const categoriesBody = readFileSync(join(fixtureDir, 'categories.json'), 'utf8')
const bundle = readFileSync('lib/client.js', 'utf8')

/**
 * The store as the previous build wrote it: ids only, and one of them names a skill
 * that no catalog page contains — the case that must be pruned rather than kept.
 */
const LEGACY_STORE = JSON.stringify({
  view: 'saved',
  category: 'all',
  sortBy: 'score',
  installed: [],
  saved: ['@nobody/vanished-skill'],
  enabled: {},
  imported: [],
})

/**
 * Render the panel once against the given store and report what it did.
 * @param {string} store - Serialized localStorage document.
 * @returns {Promise<object>} Observations.
 */
async function run(store) {
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

  window.localStorage.setItem('dsh-skill-market/v1', store)

  const requests = []
  window.fetch = async (url, init = {}) => {
    const target = String(url)
    const method = init.method ?? 'GET'
    requests.push(`${method} ${target.replace(/^.*\/skill-market\/api/, '')}`)
    if (target.includes('/category-counts')) {
      return { ok: true, status: 200, async json() { return { counts: {} } } }
    }
    const body = target.includes('/categories') ? categoriesBody : skillsBody
    return { ok: true, status: 200, async json() { return JSON.parse(body) }, async text() { return body } }
  }
  globalThis.fetch = window.fetch

  const errors = []
  const originalError = console.error
  console.error = (...args) => { errors.push(args.map(String).join(' ')) }

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
  const panelProps = { usePanelInfo: () => ({ getSnapshot: () => ({ activePanelId: 'skill-market' }) }) }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  await act(async () => { root.render(React.createElement(panelEntry.component, panelProps)) })
  for (let i = 0; i < 60; i += 1) await act(async () => { await settle() })

  // The panel always opens on 发现: the persisted view is deliberately ignored, so a stored `view: 'saved'`
  // cannot put the saved view on screen. The saved view has to be reached through its tab, the way a user
  // reaches it. Without this the assertions below were reading the market view and passing or failing for
  // reasons unrelated to what they claim to test.
  const savedTab = [...host.querySelectorAll('.sm-viewtab')]
    .find((element) => (element.textContent ?? '').trim().startsWith('收藏'))
  if (savedTab === undefined) throw new Error('the saved view tab was not found')
  await act(async () => { savedTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  for (let i = 0; i < 20; i += 1) await act(async () => { await settle() })

  console.error = originalError
  return {
    rows: host.querySelectorAll('.sm-list-row').length,
    emptyTitle: host.querySelector('.sm-empty h3')?.textContent ?? null,
    listChildren: host.querySelector('.sm-list')?.children.length ?? -1,
    toast: host.querySelector('.sm-toast')?.textContent ?? null,
    requests,
    errors,
    store: JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}'),
  }
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('case 1: an id no catalog page contains')
const vanished = await run(LEGACY_STORE)
console.log('  rows            :', vanished.rows)
console.log('  list children   :', vanished.listChildren)
console.log('  empty state     :', vanished.emptyTitle)
console.log('  toast           :', vanished.toast)
console.log('  saved after     :', JSON.stringify(vanished.store.saved))
console.log('  records after   :', JSON.stringify(vanished.store.savedSkills))
console.log('  console errors  :', JSON.stringify(vanished.errors))
console.log('assertions:')
expect(vanished.rows === 0, 'an unresolvable legacy favorite renders no row')
expect(vanished.listChildren === -1, 'no `.sm-list` is rendered at all, so nothing is half-built')
expect(vanished.emptyTitle === '收藏夹是空的', 'the empty state is what the user sees')
expect(Array.isArray(vanished.store.saved) && vanished.store.saved.length === 0, 'the dead id is pruned from storage')
expect(vanished.store.savedSkills !== undefined && Object.keys(vanished.store.savedSkills).length === 0, 'no orphan record is kept')
expect(vanished.toast !== null && vanished.toast.includes('清理'), 'the prune is reported to the user')
// React's own `act` deprecation notice is not a render failure.
const vanishedFailures = vanished.errors.filter((line) => line.includes('deprecated') === false)
expect(vanishedFailures.length === 0, `the page renders without a React error (${JSON.stringify(vanishedFailures.slice(0, 1))})`)

console.log('\ncase 2: an id the catalog does contain')
const present = await run(JSON.stringify({
  ...JSON.parse(LEGACY_STORE),
  saved: ['@indiv-ebandao/dev-expert'],
}))
console.log('  rows            :', present.rows)
console.log('  saved after     :', JSON.stringify(present.store.saved))
console.log('assertions:')
expect(present.rows === 1, 'a favorite the catalog can resolve still renders')
expect(present.store.saved.length === 1, 'and is not pruned')

console.log(failures === 0 ? '\nLEGACY STORE HANDLED' : `\n${failures} ASSERTION(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
