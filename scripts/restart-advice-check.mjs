/**
 * The restart-advice lifespan, which is the whole point of splitting the pending set
 * across two storages:
 *
 *  - a **reload** keeps the advice, because the change is still unapplied to the
 *    conversation the user is in;
 *  - a **fresh window** (what restarting the Harness produces) retires it, because
 *    the thing it was asking for has happened.
 *
 * A single `localStorage` key fails the second case, which is the bug this pins.
 *
 *   node tools/restart-advice-check.mjs [--react <node_modules>]
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
const PENDING_KEY = 'dsh-skill-market/pending/v1'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Mount the panel in a fresh jsdom realm and report the restart advice it shows.
 *
 * @param {{local?: string, session?: string, toggle?: boolean}} options - Storage
 *   to preload, and whether to flip the first installed row's switch.
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

  if (options.local !== undefined) window.localStorage.setItem(PENDING_KEY, options.local)
  if (options.session !== undefined) window.sessionStorage.setItem(PENDING_KEY, options.session)

  const install = { slug: 'dev-expert', namespace: 'indiv-ebandao', name: 'dev-expert' }

  // The panel only manages skills it already knows about, so the ledger needs one
  // installed row before there is a switch to flip. Seeded before the first render,
  // exactly as a returning user's browser has it.
  if (options.toggle === true && options.local === undefined) {
    window.localStorage.setItem('dsh-skill-market/v1', JSON.stringify({
      view: 'installed',
      category: 'all',
      sortBy: 'score',
      installed: [{
        id: `@${install.namespace}/${install.slug}`,
        installedAt: Date.now(),
        version: '2.0.3',
        directory: `C:\\Users\\tester\\.dsh\\skills\\${install.namespace}--${install.slug}`,
        directoryName: `${install.namespace}--${install.slug}`,
        registeredAs: install.name,
        files: 84,
        bytes: 1027875,
      }],
      saved: [],
      savedSkills: {},
      enabled: {},
      imported: [],
    }))
  }
  window.fetch = async (url) => {
    const target = String(url)
    if (target.includes('/installed')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            root: 'C:\\Users\\tester\\.dsh\\skills',
            disabledRoot: 'C:\\Users\\tester\\.dsh\\skill-market\\disabled',
            skills: [{
              directory: `C:\\Users\\tester\\.dsh\\skills\\${install.namespace}--${install.slug}`,
              directoryName: `${install.namespace}--${install.slug}`,
              name: install.name,
              registeredAs: install.name,
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
    if (target.includes('/enabled')) {
      return { ok: true, status: 200, async json() { return { ok: true, installed: { skills: [] } } } }
    }
    if (target.includes('/category-counts')) {
      return { ok: true, status: 200, async json() { return { counts: {} } } }
    }
    const body = target.includes('/categories') ? categoriesBody : skillsBody
    return { ok: true, status: 200, async json() { return JSON.parse(body) }, async text() { return body } }
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

  let opened = null
  let switchFound = null
  /** Open the 已安装 view, where the restart advice lives. */
  const openInstalled = async () => {
    const tab = Array.from(host.querySelectorAll('.sm-viewtab'))
      .find((element) => (element.textContent ?? '').startsWith('已安装'))
    if (tab === undefined) return false
    await act(async () => {
      tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
    return true
  }

  if (options.toggle === true) {
    opened = await openInstalled()
    const input = host.querySelector('.sm-list-row .sm-switch input')
    switchFound = input !== null
    if (input !== null) {
      await act(async () => { input.click(); await settle() })
    }
    for (let i = 0; i < 10; i += 1) await act(async () => { await settle() })
  } else if (options.openInstalled === true) {
    // The advice is rendered by the 已安装 view, so a reload has to land there to
    // observe it — the same place a returning user goes to check their skills.
    opened = await openInstalled()
    for (let i = 0; i < 10; i += 1) await act(async () => { await settle() })
  }

  const advice = host.querySelector('.sm-restart-banner')
  return {
    opened,
    switchFound,
    rowCount: host.querySelectorAll('.sm-list-row').length,
    adviceShown: advice !== null,
    adviceText: (advice?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    localPending: window.localStorage.getItem(PENDING_KEY),
    sessionMarker: window.sessionStorage.getItem(PENDING_KEY),
  }
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('1) a toggle raises the advice and records both markers')
const first = await run({ toggle: true })
console.log('  opened tab      :', first.opened)
console.log('  installed rows  :', first.rowCount, '| switch found:', first.switchFound)
console.log('  advice          :', first.adviceShown ? JSON.stringify(first.adviceText) : '(none)')
console.log('  localStorage    :', JSON.stringify(first.localPending))
console.log('  sessionStorage  :', JSON.stringify(first.sessionMarker))
expect(first.adviceShown, 'the advice appears right after a change')
expect(first.adviceText.includes('重启 DeepSeek Harness 后生效'), 'it says only that a restart is needed')
expect(first.localPending !== null, 'the payload is written to localStorage')
expect(first.sessionMarker !== null, 'the session marker is written to sessionStorage')

console.log('\n2) a reload (both storages intact) keeps the advice')
const reloaded = await run({ local: first.localPending, session: 'pending', openInstalled: true })
console.log('  advice          :', reloaded.adviceShown ? JSON.stringify(reloaded.adviceText) : '(none)')
expect(reloaded.adviceShown, 'the advice survives a reload')

console.log('\n3) a fresh window (localStorage only) retires it')
const restarted = await run({ local: first.localPending })
console.log('  advice          :', restarted.adviceShown ? JSON.stringify(restarted.adviceText) : '(none)')
console.log('  localStorage    :', JSON.stringify(restarted.localPending))
expect(restarted.adviceShown === false, 'the advice is gone after a restart')
expect(restarted.localPending === null, 'and its stale payload is cleared from storage')

console.log(failures === 0 ? '\nRESTART ADVICE LIFESPAN OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
