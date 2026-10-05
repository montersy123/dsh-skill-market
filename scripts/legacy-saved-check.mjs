/**
 * Seven legacy-store cases, all from builds that persisted the panel's state somewhere it no longer
 * lives.
 *
 * Cases 1 and 2 come from the build that persisted favorite **ids without records**. The product
 * decision is to discard data that cannot be resolved rather than migrate it, so the expectations
 * are the opposite of a rescue: the page must not crash, must show what it can still resolve, and
 * must prune the ids that can never be resolved instead of keeping entries that will never render.
 *
 * Case 3 is the move itself. The state used to live in the page's Web Storage �?which on the
 * desktop is DSH's own Local Storage, not this plugin's �?and now lives in a file the Host owns.
 * An existing user must keep every favorite and ledger row across that change, and the old keys
 * must be **deleted**, because leaving a stale copy behind is the thing the move exists to end.
 *
 * Case 4 is the authority split while both copies exist: the file wins for what the Host derives
 * (the category, the ledger), while favorites �?which only the user can create �?are unioned in
 * case 6 rather than dropped.
 *
 * Case 5 is that move failing halfway, which is not hypothetical: a page running an updated client
 * against an older Host half (one without the `state` route) adopted the old keys, deleted them,
 * and then could not store the document anywhere �?the favorites had to be recovered out of
 * LevelDB's write-ahead log. Deleting before storing is the defect; the fix is that the keys are
 * removed only once the write has landed, and a rescue copy is kept while it has not.
 *
 * Case 6 is both copies present at once �?a page still running the previous client keeps writing its
 * own keys until it is closed �?where the favorites must be unioned rather than one side winning.
 *
 * Case 7 is the other leftover an older build could leave: a favorite record whose id is no longer
 * in the favorite list. Nothing renders it, and the file would carry it forever.
 *
 *   node scripts/legacy-saved-check.mjs
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

const LEGACY_STATE_KEY = 'dsh-skill-market/v1'
const LEGACY_PENDING_KEY = 'dsh-skill-market/pending/v1'

/**
 * The store as the previous build wrote it: ids only, and one of them names a skill
 * that no catalog page contains �?the case that must be pruned rather than kept.
 */
const LEGACY_STORE = {
  view: 'saved',
  category: 'all',
  sortBy: 'score',
  installed: [],
  saved: ['@nobody/vanished-skill'],
  enabled: {},
  imported: [],
}

/**
 * Render the panel once against the given stores and report what it did.
 *
 * @param {object} options - What to seed.
 * @param {object | null} [options.stored] - Document the Host already holds.
 * @param {object} [options.legacy] - Document an earlier build left in Web Storage.
 * @param {string[]} [options.legacyPending] - Pending set an earlier build left in Web Storage.
 * @param {object[]} [options.onDisk] - Rows the stub Host reports as installed on disk.
 * @param {boolean} [options.failWrites] - Whether the stub Host refuses to store the document.
 * @returns {Promise<object>} Observations.
 */
async function run(options) {
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

  if (options.legacy !== undefined) window.localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(options.legacy))
  if (options.legacyPending !== undefined) window.localStorage.setItem(LEGACY_PENDING_KEY, JSON.stringify(options.legacyPending))

  const state = createPanelStateStub({ state: options.stored ?? null, failWrites: options.failWrites === true })
  const requests = []
  window.fetch = async (url, init = {}) => {
    const target = String(url)
    const method = init.method ?? 'GET'
    requests.push(`${method} ${target.replace(/^.*\/skill-market\/api/, '')}`)
    let body
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body) } catch { body = init.body }
    }
    const answer = state.answer(target, method, body)
    if (answer !== null) return answer
    if (target.includes('/installed')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { root: 'C:\\Users\\tester\\.dsh\\skills', skills: options.onDisk ?? [], disabled: [] }
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
  // Everything is read before the panel is unmounted: the observations below are about the DOM
  // it rendered, and unmounting empties it.
  const observations = {
    rows: host.querySelectorAll('.sm-list-row').length,
    emptyTitle: host.querySelector('.sm-empty h3')?.textContent ?? null,
    listChildren: host.querySelector('.sm-list')?.children.length ?? -1,
    toast: host.querySelector('.sm-toast')?.textContent ?? null,
  }
  /** The document the panel left in the file, after any deferred write has landed. */
  const stored = state.store.state ?? {}
  /** The old keys, read before the window is closed: `close()` takes the document with it. */
  const legacyStateKey = window.localStorage.getItem(LEGACY_STATE_KEY)
  const legacyPendingKey = window.localStorage.getItem(LEGACY_PENDING_KEY)
  // The panel's periodic re-read keeps the event loop alive; the render is over, so let the
  // effect cleanup run rather than leaving a live interval behind for the rest of this script.
  await act(async () => { root.unmount() })
  window.close()
  return {
    ...observations,
    requests,
    errors,
    stored,
    writes: state.store.writes,
    legacyStateKey,
    legacyPendingKey,
  }
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('case 1: an id no catalog page contains')
const vanished = await run({ legacy: LEGACY_STORE })
console.log('  rows            :', vanished.rows)
console.log('  list children   :', vanished.listChildren)
console.log('  empty state     :', vanished.emptyTitle)
console.log('  toast           :', vanished.toast)
console.log('  saved after     :', JSON.stringify(vanished.stored.saved))
console.log('  records after   :', JSON.stringify(vanished.stored.savedSkills))
console.log('  console errors  :', JSON.stringify(vanished.errors))
console.log('assertions:')
expect(vanished.rows === 0, 'an unresolvable legacy favorite renders no row')
expect(vanished.listChildren === -1, 'no `.sm-list` is rendered at all, so nothing is half-built')
expect(vanished.emptyTitle === '收藏夹是空的', 'the empty state is what the user sees')
expect(Array.isArray(vanished.stored.saved) && vanished.stored.saved.length === 0, 'the dead id is pruned from the stored document')
expect(vanished.stored.savedSkills !== undefined && Object.keys(vanished.stored.savedSkills).length === 0, 'no orphan record is kept')
expect(vanished.toast !== null && vanished.toast.includes('清理'), 'the prune is reported to the user')
// React's own `act` deprecation notice is not a render failure.
const vanishedFailures = vanished.errors.filter((line) => line.includes('deprecated') === false)
expect(vanishedFailures.length === 0, `the page renders without a React error (${JSON.stringify(vanishedFailures.slice(0, 1))})`)

console.log('\ncase 2: an id the catalog does contain')
const present = await run({ legacy: { ...LEGACY_STORE, saved: ['@indiv-ebandao/dev-expert'] } })
console.log('  rows            :', present.rows)
console.log('  saved after     :', JSON.stringify(present.stored.saved))
console.log('assertions:')
expect(present.rows === 1, 'a favorite the catalog can resolve still renders')
expect(present.stored.saved.length === 1, 'and is not pruned')

console.log('\ncase 3: Web Storage state is adopted by the file, then deleted')
const legacyLedger = {
  ...LEGACY_STORE,
  category: 'dev-programming',
  installed: [{
    id: '@indiv-ebandao/dev-expert',
    installedAt: 1_700_000_000_000,
    version: '2.0.1',
    directory: 'C:\\Users\\tester\\.dsh\\skills\\indiv-ebandao--dev-expert',
    directoryName: 'indiv-ebandao--dev-expert',
    registeredAs: 'dev-expert',
    files: 84,
    bytes: 1027875,
  }],
  saved: ['@indiv-ebandao/dev-expert'],
  savedSkills: { '@indiv-ebandao/dev-expert': { id: '@indiv-ebandao/dev-expert', name: '编程专家', version: '2.0.1' } },
  enabled: { 'indiv-ebandao--dev-expert': true },
}
const adopted = await run({
  legacy: legacyLedger,
  legacyPending: ['indiv-ebandao--dev-expert'],
  // The stub Host reports the same skill the ledger names, so the mount reconciliation confirms
  // the adopted row instead of dropping it as a skill that is not on this machine.
  onDisk: [{
    directory: 'C:\\Users\\tester\\.dsh\\skills\\indiv-ebandao--dev-expert',
    directoryName: 'indiv-ebandao--dev-expert',
    handle: 'indiv-ebandao',
    slug: 'dev-expert',
    name: 'dev-expert',
    registeredAs: 'dev-expert',
    origin: 'market',
    version: '2.0.1',
    installedAt: 1_700_000_000_000,
    files: 84,
    bytes: 1027875,
    enabled: true,
    registered: true,
  }],
})
console.log('  writes          :', adopted.writes.length)
console.log('  category after  :', JSON.stringify(adopted.stored.category))
console.log('  saved after     :', JSON.stringify(adopted.stored.saved))
console.log('  pending after   :', JSON.stringify(adopted.stored.pending))
console.log('  legacy key      :', JSON.stringify(adopted.legacyStateKey))
console.log('assertions:')
expect(adopted.writes.length > 0, 'the adopted document is written to the Host, not only held in the page')
expect(adopted.stored.category === 'dev-programming', 'the stored category survives the move')
expect(adopted.stored.saved.length === 1 && adopted.stored.saved[0] === '@indiv-ebandao/dev-expert',
  'the favorite survives the move')
expect(adopted.stored.savedSkills?.['@indiv-ebandao/dev-expert']?.name === '编程专家',
  'and so does its record, which is what makes it render')
expect(adopted.stored.installed.length === 1, 'the ledger survives the move')
expect(adopted.stored.pending?.dirs?.length === 1, 'the restart advice survives the move')
expect(adopted.legacyStateKey === null, 'the old Web Storage document is deleted once adopted')
expect(adopted.legacyPendingKey === null, 'and so is the old pending key')

console.log('\ncase 4: the file is the authority for what the Host derives')
const stored = await run({
  stored: { category: 'all', installed: [], saved: [], savedSkills: {}, enabled: {}, pending: { since: 0, dirs: [] } },
  legacy: legacyLedger,
})
console.log('  category after  :', JSON.stringify(stored.stored.category))
console.log('  installed after :', stored.stored.installed.length)
console.log('assertions:')
expect(stored.stored.category === 'all', 'the file wins for the category, which is a preference the Host stores')
expect(stored.stored.installed.length === 0, 'and for the ledger, which the Host reconciles from disk anyway')
expect(stored.legacyStateKey === null, 'while the leftover copy is deleted once the merged document has landed')

console.log('\ncase 5: a Host that cannot store the document must not cost the user their data')
const unstorable = await run({ legacy: legacyLedger, failWrites: true })
console.log('  writes          :', unstorable.writes.length)
console.log('  legacy key      :', JSON.stringify((unstorable.legacyStateKey ?? '').slice(0, 80)))
console.log('  rescue saved    :', JSON.stringify((() => {
  try { return JSON.parse(unstorable.legacyStateKey ?? '{}').saved } catch { return '(unreadable)' }
})()))
console.log('  rendered rows   :', unstorable.rows)
console.log('assertions:')
expect(unstorable.writes.length === 0, 'the refused write really was refused')
expect(unstorable.legacyStateKey !== null, 'the old keys are NOT deleted before the document is stored')
expect(JSON.parse(unstorable.legacyStateKey ?? '{}').saved?.[0] === '@indiv-ebandao/dev-expert',
  'and the rescue copy still carries the favorite')
expect(unstorable.legacyPendingKey !== null, 'the rescue copy covers the restart advice too')
expect(unstorable.rows === 1, 'the panel renders the favorite from its own memory all the same')

console.log('\ncase 6: a file and a leftover copy both present �?the favorites are unioned')
const merged = await run({
  // The file is what the Host holds; the leftover keys are what a page running the previous client
  // wrote while this one was already using the file.
  stored: {
    category: 'all',
    installed: [],
    saved: ['@indiv-ebandao/dev-expert'],
    savedSkills: { '@indiv-ebandao/dev-expert': { id: '@indiv-ebandao/dev-expert', name: '编程专家' } },
    enabled: {},
    pending: { since: 0, dirs: [] },
  },
  legacy: { ...LEGACY_STORE, saved: ['@indiv-ebandao/parenting-expert'] },
})
console.log('  saved after     :', JSON.stringify(merged.stored.saved))
console.log('assertions:')
expect(merged.stored.saved.includes('@indiv-ebandao/dev-expert'), 'the favorite the file held is kept')
expect(merged.stored.saved.includes('@indiv-ebandao/parenting-expert'),
  'and the one only the leftover copy held is added rather than dropped')
expect(merged.writes.length > 0, 'the union is written back to the Host')
expect(merged.legacyStateKey === null, 'and the leftover copy is gone once it has landed')

console.log('\ncase 7: records whose favorite is gone are dropped, and the file is rewritten')
const orphaned = await run({
  // The shape an earlier build could leave behind: the favorite was removed from `saved`, but its
  // record stayed in `savedSkills` �?invisible in the panel, and only findable by opening the file.
  stored: {
    category: 'all',
    installed: [],
    saved: ['@indiv-ebandao/dev-expert'],
    savedSkills: {
      '@indiv-ebandao/dev-expert': { id: '@indiv-ebandao/dev-expert', name: '编程专家' },
      '@user_814dbe54/dev-expert': { id: '@user_814dbe54/dev-expert', name: 'dev-expert' },
      '@tencent-adm/tencent-docs': { id: '@tencent-adm/tencent-docs', name: '腾讯文档 TENCENT DOCS' },
    },
    enabled: {},
    pending: { since: 0, dirs: [] },
  },
})
console.log('  saved after     :', JSON.stringify(orphaned.stored.saved))
console.log('  records after   :', JSON.stringify(Object.keys(orphaned.stored.savedSkills ?? {})))
console.log('assertions:')
expect(orphaned.stored.saved.length === 1, 'the favorite itself is untouched')
expect(orphaned.stored.savedSkills['@indiv-ebandao/dev-expert'] !== undefined,
  'and keeps the record that renders it')
expect(orphaned.stored.savedSkills['@user_814dbe54/dev-expert'] === undefined,
  'a record whose id is not in the favorite list is dropped')
expect(orphaned.stored.savedSkills['@tencent-adm/tencent-docs'] === undefined, 'both of them are')
expect(orphaned.writes.length > 0, 'and the file is rewritten for it, rather than left to a later change')

console.log(failures === 0 ? '\nLEGACY STORE HANDLED' : `\n${failures} ASSERTION(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1

