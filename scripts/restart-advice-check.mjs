/**
 * The restart-advice lifespan.
 *
 * Changing a skill is applied by the Host immediately, but an already open conversation keeps the
 * catalog its agent was created with, so the panel says a restart is needed. That advice has two
 * requirements that pull in opposite directions:
 *
 *  - a **reload** must keep it, because the change is still unapplied to the conversation the user
 *    is in;
 *  - the **restart it asks for** must retire it, because the thing it asked for has happened.
 *
 * The advice used to be retired by a fresh *window* — a heuristic, because `localStorage` cannot
 * tell a reload from a restart and a `sessionStorage` marker was the closest available proxy. It
 * is now recorded against the epoch time the running Host started, so the boundary is the event
 * the advice is actually about. This pins all three cases:
 *
 *  1. a toggle raises the advice, recorded against the current Host start time;
 *  2. a reload against the same Host keeps it;
 *  3. a Host that started later retires it, and the stale payload is cleared from the file.
 *
 *   node scripts/restart-advice-check.mjs [--react <node_modules>]
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

/** The Host start time scenarios 1 and 2 share, and scenario 3 moves past. */
const HOST_START = 1_700_000_000_000

/** The one installed skill every scenario manages, as the stub Host reports it. */
const INSTALL = { slug: 'dev-expert', namespace: 'indiv-ebandao', name: 'dev-expert' }
const ON_DISK = [{
  directory: `C:\\Users\\tester\\.dsh\\skills\\${INSTALL.namespace}--${INSTALL.slug}`,
  directoryName: `${INSTALL.namespace}--${INSTALL.slug}`,
  handle: INSTALL.namespace,
  slug: INSTALL.slug,
  name: INSTALL.name,
  registeredAs: INSTALL.name,
  origin: 'market',
  version: '2.0.3',
  installedAt: HOST_START,
  files: 84,
  bytes: 1027875,
  enabled: true,
  registered: true,
}]

/**
 * Mount the panel in a fresh jsdom realm and report the restart advice it shows.
 *
 * @param {{stored?: object | null, hostStartedAt?: number, toggle?: boolean, openInstalled?: boolean}} options
 *   The document the Host already holds, its process start time, and what to do in the panel.
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

  const state = createPanelStateStub({
    state: options.stored ?? null,
    harnessStartedAt: options.hostStartedAt ?? HOST_START,
  })
  window.fetch = async (url, init = {}) => {
    const target = String(url)
    const method = init.method ?? 'GET'
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
          return { root: 'C:\\Users\\tester\\.dsh\\skills', disabledRoot: 'C:\\Users\\tester\\.dsh\\profiles\\desktop\\@montersy123-dsh-skill-market\\data\\skills', skills: ON_DISK, disabled: [] }
        },
      }
    }
    if (target.includes('/enabled')) {
      return { ok: true, status: 200, async json() { return { ok: true, installed: { skills: [] } } } }
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
  const observations = {
    opened,
    switchFound,
    rowCount: host.querySelectorAll('.sm-list-row').length,
    adviceShown: advice !== null,
    adviceText: (advice?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }
  const stored = state.store.state
  const writes = state.store.writes.length
  await act(async () => { root.unmount() })
  window.close()
  return { ...observations, stored, writes }
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('1) a toggle raises the advice and records it against the running Host')
const first = await run({ stored: null, toggle: true })
console.log('  opened tab      :', first.opened)
console.log('  installed rows  :', first.rowCount, '| switch found:', first.switchFound)
console.log('  advice          :', first.adviceShown ? JSON.stringify(first.adviceText) : '(none)')
console.log('  stored pending  :', JSON.stringify(first.stored?.pending))
expect(first.adviceShown, 'the advice appears right after a change')
expect(first.adviceText.includes('重启 DeepSeek Harness 后生效'), 'it says only that a restart is needed')
expect(first.stored?.pending?.dirs?.includes(`${INSTALL.namespace}--${INSTALL.slug}`) === true,
  'the payload is written to the stored document')
expect(first.stored?.pending?.since === HOST_START, 'and recorded against the running Host start time')

console.log('\n2) a reload against the same Host keeps the advice')
const reloaded = await run({ stored: first.stored, hostStartedAt: HOST_START, openInstalled: true })
console.log('  advice          :', reloaded.adviceShown ? JSON.stringify(reloaded.adviceText) : '(none)')
expect(reloaded.adviceShown, 'the advice survives a reload')
expect(reloaded.stored?.pending?.dirs?.length === 1, 'and the payload is left alone')

console.log('\n3) a Host that started later retires it')
const restarted = await run({ stored: first.stored, hostStartedAt: HOST_START + 60_000, openInstalled: true })
console.log('  advice          :', restarted.adviceShown ? JSON.stringify(restarted.adviceText) : '(none)')
console.log('  stored pending  :', JSON.stringify(restarted.stored?.pending))
expect(restarted.adviceShown === false, 'the advice is gone after a restart')
expect(restarted.stored?.pending?.dirs?.length === 0, 'and the stale payload is cleared from the stored document')
expect(restarted.writes > 0, 'which is written back, so it cannot reappear on the next load')

console.log(failures === 0 ? '\nRESTART ADVICE LIFESPAN OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
