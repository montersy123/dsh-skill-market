/**
 * One document, two windows.
 *
 * The panel used to keep its state in `localStorage`, where a write in one window raised a
 * `storage` event in every other, so two open panels stayed in step for free. The state is a file
 * now, and a file raises nothing — so the panel asks the Host instead, on focus and on a slow
 * interval, and this pins that replacement rather than assuming it:
 *
 *  1. a panel mounted over a stored document renders what is in it;
 *  2. a document another window wrote is adopted when this one regains focus;
 *  3. and adopting it does not write it straight back, which would be a pointless write on every
 *     focus and would make two windows trade the same document forever.
 *
 *   node scripts/panel-sync-check.mjs [--react <node_modules>]
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPanelStateStub } from './dev/panel-state-stub.mjs'

const reactDir = process.argv[2] ?? 'scripts/dev/reactsmoke/node_modules'
const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)
const React = thirdPartyRequire('react')
const { JSDOM } = thirdPartyRequire('jsdom')

const fixtureDir = 'tests/fixture'
const skillsBody = readFileSync(join(fixtureDir, 'skills.json'), 'utf8')
const categoriesBody = readFileSync(join(fixtureDir, 'categories.json'), 'utf8')
const bundle = readFileSync('lib/client.js', 'utf8')
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The Host start time every window in this check shares: nothing is restarting here. */
const HOST_START = 1_700_000_000_000

/**
 * Fixture names by canonical id.
 *
 * The assertions below compare against what the catalogue renders, not against a name invented
 * here: a saved record is replaced by live catalogue data as soon as a page carrying that skill
 * loads, so the record's own `name` is not what a mounted panel shows.
 */
const catalogueNames = Object.fromEntries(
  JSON.parse(skillsBody).data.skills.map((raw) => [raw.namespace?.canonicalName, raw.name]),
)

/** One skill the fixture's first page really carries, so a saved record can be resolved. */
const FIRST = { id: '@indiv-ebandao/dev-expert', name: catalogueNames['@indiv-ebandao/dev-expert'] ?? 'dev-expert', version: '2.0.3' }
/** A second one, saved by "the other window" while this one is open. */
const SECOND = { id: '@indiv-ebandao/parenting-expert', name: catalogueNames['@indiv-ebandao/parenting-expert'] ?? 'parenting-expert', version: '1.4.0' }

/**
 * The document a window starts from: one favorite, with its record.
 * @param {object[]} records - Records to save.
 * @returns {object} Stored document.
 */
function documentWith(records) {
  return {
    category: 'all',
    installed: [],
    saved: records.map((record) => record.id),
    savedSkills: Object.fromEntries(records.map((record) => [record.id, record])),
    enabled: {},
    pending: { since: 0, dirs: [] },
  }
}

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

const panelState = createPanelStateStub({ state: documentWith([FIRST]), harnessStartedAt: HOST_START })
window.fetch = async (url, init = {}) => {
  const target = String(url)
  const method = init.method ?? 'GET'
  let body
  if (typeof init.body === 'string') {
    try { body = JSON.parse(init.body) } catch { body = init.body }
  }
  const answer = panelState.answer(target, method, body)
  if (answer !== null) return answer
  if (target.includes('/installed')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          root: 'C:\\Users\\tester\\.dsh\\skills',
          // `dev-expert` is installed; the second favorite is not, which is the ordinary case for a
          // favorite: saved to install later rather than already on disk.
          skills: [{
            directory: 'C:\\Users\\tester\\.dsh\\skills\\indiv-ebandao--dev-expert',
            directoryName: 'indiv-ebandao--dev-expert',
            handle: 'indiv-ebandao',
            slug: 'dev-expert',
            name: 'dev-expert',
            registeredAs: 'dev-expert',
            origin: 'market',
            version: '2.0.3',
            installedAt: HOST_START,
            files: 84,
            bytes: 1027875,
            enabled: true,
            registered: true,
          }],
          disabled: [],
        }
      },
    }
  }
  if (target.includes('/category-counts')) {
    return { ok: true, status: 200, async json() { return { counts: {} } } }
  }
  const fixture = target.includes('/categories') ? categoriesBody : skillsBody
  return { ok: true, status: 200, async json() { return JSON.parse(fixture) }, async text() { return fixture } }
}
globalThis.fetch = window.fetch

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

await act(async () => { root.render(React.createElement(panelEntry.component, panelProps)) })
for (let i = 0; i < 40; i += 1) await act(async () => { await settle() })

/** Open the 收藏 view, where the document's favorites are what is on screen. */
const openSaved = async () => {
  const tab = Array.from(host.querySelectorAll('.sm-viewtab'))
    .find((element) => (element.textContent ?? '').startsWith('收藏'))
  if (tab === undefined) return false
  await act(async () => {
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  for (let i = 0; i < 10; i += 1) await act(async () => { await settle() })
  return true
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('1) a mounted panel renders the stored document')
const opened = await openSaved()
const namesOf = () => Array.from(host.querySelectorAll('.sm-list-row h3')).map((element) => element.textContent)
console.log('  opened 收藏     :', opened)
console.log('  rows            :', JSON.stringify(namesOf()))
expect(opened, 'the 收藏 view opens')
expect(namesOf().length === 1 && namesOf()[0] === FIRST.name, 'the favorite in the document is on screen')

console.log('\n2) a document another window wrote is adopted on focus')
const writesBefore = panelState.store.writes.length
panelState.store.state = documentWith([FIRST, SECOND])
panelState.store.revision += 1
await act(async () => {
  window.dispatchEvent(new window.Event('focus'))
  for (let i = 0; i < 20; i += 1) await settle()
})
console.log('  rows            :', JSON.stringify(namesOf()))
expect(namesOf().length === 2, 'the second window\'s favorite appears without a reload')
expect(namesOf().includes(SECOND.name), 'and it is the skill that window saved')

console.log('\n3) adopting it does not write it back')
console.log('  writes          :', writesBefore, '->', panelState.store.writes.length)
expect(panelState.store.writes.length === writesBefore,
  'a sync writes nothing: the document is already what the Host holds')

console.log('\n4) a panel with no channel still shows what it had')
// The focus sync is best effort: a Host that cannot answer must not empty the list. Both realms are
// pointed at the failing transport — the bundle resolves `fetch` from the global, while this
// harness stubs the jsdom window — or the outage would not actually reach the panel.
const beforeOutage = namesOf().length
const offline = async () => { throw new Error('offline') }
window.fetch = offline
globalThis.fetch = offline
await act(async () => {
  window.dispatchEvent(new window.Event('focus'))
  for (let i = 0; i < 20; i += 1) await settle()
})
console.log('  rows            :', JSON.stringify(namesOf()))
expect(namesOf().length === beforeOutage, 'an unreachable Host leaves the rendered favorites alone')

await act(async () => { root.unmount() })
window.close()

console.log(failures === 0 ? '\nPANEL SYNC OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
