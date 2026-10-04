/**
 * Register the skill-market client plugin with the REAL Cordis runtime, the way
 * `ClientEntries.create` + the client Loader do it — `ctx.plugin(moduleFace)`
 * with a live context. My other harnesses stub the context; this one does not,
 * so a plugin shape, injection, or effect mistake fails here the way it fails in
 * the page (`<id>: failed` in the boot audit).
 *
 *   node tools/cordis-client-check.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ASAR_OUT = resolve('scripts/dev/asar-out')
const CORDIS = join(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/cordis/lib/index.js')
const BUNDLE = resolve('lib/client.js')
const REACT_DIR = resolve('scripts/dev/reactsmoke/node_modules')

const thirdPartyRequire = createRequire(pathToFileURL(join(REACT_DIR, 'package.json')).href)
const React = thirdPartyRequire('react')

/** Collect the stylesheets the plugin registers through `<style>` tags. */
const styleTags = []
globalThis.window = globalThis
// Deliberately NO `globalThis.styles`: a dynamic bundle is a classic script that
// receives only `window`, `document` and `require`, so any other free global must
// fail here exactly as it fails in the page.
globalThis.document = {
  head: { appendChild: (tag) => styleTags.push(tag) },
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  querySelectorAll: () => [],
  querySelector: () => null,
}
globalThis.window.__ModuleLoader__ = { mode: 'queue', pendingQueue: [], load(r) { this.pendingQueue.push(r) } }

// Materialise the plugin bundle, exactly as the page's <script> does.
new Function('window', 'document', 'console', readFileSync(BUNDLE, 'utf8'))(
  globalThis.window, globalThis.document, console,
)
const registration = globalThis.window.__ModuleLoader__.pendingQueue[0]
const moduleFace = registration.factory((specifier) => {
  if (specifier === 'react') return React
  throw new Error(`unsupported external: ${specifier}`)
})
console.log('module face keys:', Object.keys(moduleFace).join(','), '| name:', moduleFace.name, '| inject:', JSON.stringify(moduleFace.inject))

// The real Cordis runtime.
const cordis = await import(pathToFileURL(CORDIS).href)
const { Context } = cordis

const root = new Context()
// Client rows see `slots` (from the slot plugin) and a `loader`; provide the
// smallest faithful stand-ins so the plugin's own code is what is under test.
const registered = []
root.provide('slots', {
  inject: (key, callback) => { callback(); return () => {} },
  register: (declaration, component) => {
    if (typeof declaration?.name !== 'string') throw new Error('registration needs a slot name')
    if (typeof component !== 'function') throw new Error('registration needs a component')
    registered.push(`${declaration.name}${declaration.key === undefined ? '' : `[${declaration.key}]`}${declaration.id === undefined ? '' : `[${declaration.id}]`}`)
    return () => {}
  },
  registerFactory: () => () => {},
})

/**
 * A faithful stand-in for `@deepseek-ai/dsh-client-locale`.
 *
 * Not a stub that swallows anything: the panel now injects `locale`, and if it is absent Cordis leaves
 * the plugin pending forever — which is exactly what this harness reported when the panel first
 * declared it, and is why the dependency had to be verified as really shipped before being declared.
 *
 * The behaviour is copied from the packaged service: `bind` caches a function that resolves against
 * the snapshot when called, and an unknown key resolves to the key itself. The panel's fallback logic
 * only means something against that last property, so a stub that returned dictionary text instead
 * would make the test pass without testing it.
 */
const localeDictionaries = new Map()
const localeListeners = new Set()
let localeActive = 'zh'
// The real service exposes a monotonic revision; registering a dictionary or switching language advances it,
// and consumers that read the snapshot re-render on the change. The plugin's registration is asserted below,
// because "the dictionaries reached the service" is the whole point of calling `register`.
let localeRevision = 1
const localeRegistrations = []
const localeService = {
  register(ns, localeOrDicts, dict) {
    const pairs = typeof localeOrDicts === 'string' ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts)
    let locales = localeDictionaries.get(ns)
    if (locales === undefined) { locales = new Map(); localeDictionaries.set(ns, locales) }
    for (const [locale, entries] of pairs) {
      // The real implementation accepts a namespace's locales in separate calls, so re-registering one that is
      // already present is a mistake only when it is the same locale twice in one call.
      if (locales.has(locale) === false) locales.set(locale, entries)
    }
    localeRegistrations.push({ ns, locales: pairs.map(([locale]) => locale) })
    localeRevision += 1
    for (const listener of localeListeners) listener()
    return () => { for (const [locale] of pairs) locales.delete(locale) }
  },
  bind(ns) {
    return (key, params) => {
      const text = localeDictionaries.get(ns)?.get(localeActive)?.[key]
        ?? localeDictionaries.get(ns)?.get('en')?.[key]
      // The real service falls back to the key, and the panel detects that to use its own table.
      if (text === undefined) return key
      if (params === undefined) return text
      return String(text).replace(/\{(\w+)\}/g, (whole, name) => (
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
      ))
    }
  },
  getSnapshot() { return { active: localeActive, revision: localeRevision } },
  subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener) },
  localeList() { return [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }] },
}
root.provide('locale', localeService)

root.provide('loader', { internal: { version: 'client' } })

let fiber
try {
  fiber = root.plugin(moduleFace)
  await fiber
} catch (error) {
  console.error('PLUGIN FAILED:', error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
}

const state = fiber.state
console.log('fiber state:', state, '(2 = active)')
console.log('slot registrations:', JSON.stringify(registered))
console.log('stylesheet <style> tags:', styleTags.length, 'chars:', styleTags.map((tag) => String(tag.textContent).length).join(','))
console.log('plugin name Cordis recorded:', JSON.stringify(fiber.runtime?.name ?? null))
console.log('declared inject on the fiber:', JSON.stringify(Object.keys(fiber.inject ?? {})))

if (state !== 2) process.exit(1)

// The panel must actually translate through the service, not merely declare the dependency. These
// assertions run against the service stand-in above, whose "unknown key resolves to the key" behaviour
// is what the panel's dictionary fallback is written for.
const t = moduleFace.tForTest
if (typeof t !== 'function') {
  console.error('FAIL: the client half does not expose its translator for testing')
  process.exit(1)
}
const englishBefore = t('card.install')
if (englishBefore !== '安装') {
  console.error(`FAIL: with active=zh the translator returned ${JSON.stringify(englishBefore)}, expected 安装`)
  process.exit(1)
}

// Register the namespace the way a language pack would, so the *service* path is exercised. Without
// this the service answers every key with the key, the panel falls back to its own dictionary, and the
// test would pass while proving nothing about the injection.
localeService.register(moduleFace.name, {
  zh: {
    'card.install': '安装',
    'time.days': '{count} 天前',
    'restart.effect': '重启 DeepSeek Harness 后生效',
    'tab.overview': '概览',
    'tab.safety': '安全扫描',
  },
  en: {
    'card.install': 'Install',
    'time.days': '{count} d ago',
    'restart.effect': 'Restart DeepSeek Harness to apply',
    'tab.overview': 'Overview',
    'tab.safety': 'Security scan',
  },
})
localeActive = 'en'
const englishAfter = t('card.install')
if (englishAfter !== 'Install') {
  console.error(`FAIL: after switching to en the translator returned ${JSON.stringify(englishAfter)}`)
  process.exit(1)
}
// A key the registered namespace does not hold must still render, via the shipped dictionary — this is
// the path that keeps a partially translated namespace from filling the panel with raw keys.
const unregistered = t('safety.badge')
if (/^[a-z]+\./.test(unregistered)) {
  console.error(`FAIL: an unregistered key leaked through as ${JSON.stringify(unregistered)}`)
  process.exit(1)
}
// And a placeholder must survive both paths.
if (t('time.days', { count: 3 }) !== '3 d ago') {
  console.error(`FAIL: placeholder substitution produced ${JSON.stringify(t('time.days', { count: 3 }))}`)
  process.exit(1)
}
localeActive = 'zh'
const fallbackPath = (() => { localeActive = 'zh'; const value = t('safety.badge'); localeActive = 'en'; return value })()

// Every key the panel uses must have English, not just the handful registered above. This is the assertion
// that makes "the panel is bilingual" a checked claim rather than a description: a missing English entry
// would otherwise render Chinese inside an English UI, which no test would notice.
const { ZH, EN } = await import('../lib/locale.js')
const { collectKeys } = await import('./i18n-keys.mjs')
const referenced = collectKeys(readFileSync(BUNDLE, 'utf8'))
const missingEnglish = [...referenced].filter((key) => EN[key] === undefined)
if (missingEnglish.length > 0) {
  console.error(`FAIL: ${String(missingEnglish.length)} key(s) have no English: ${missingEnglish.slice(0, 8).join(', ')}`)
  process.exit(1)
}
// And the two languages must actually differ, or "English" is Chinese with a different label.
const identical = [...referenced].filter((key) => EN[key] === ZH[key] && /[\u4e00-\u9fff]/.test(String(ZH[key])))
if (identical.length > 0) {
  console.error(`FAIL: ${String(identical.length)} English value(s) are still Chinese: ${identical.slice(0, 8).join(', ')}`)
  process.exit(1)
}
// A sample of the drawer tabs, which is where the raw keys reached the screen before.
const englishTabs = ['tab.overview', 'tab.files', 'tab.versions', 'tab.permissions', 'tab.safety', 'tab.metrics']
localeActive = 'en'
const tabLabels = englishTabs.map((key) => t(key))
if (tabLabels.some((label) => /^tab\./.test(label))) {
  console.error(`FAIL: a drawer tab rendered as a raw key: ${JSON.stringify(tabLabels)}`)
  process.exit(1)
}
localeActive = 'zh'
const chineseTabs = englishTabs.map((key) => t(key))
if (chineseTabs[0] !== '概览' || chineseTabs[4] !== '安全扫描') {
  console.error(`FAIL: the drawer tabs did not translate: ${JSON.stringify(chineseTabs)}`)
  process.exit(1)
}

// The plugin must register its dictionaries with the service, not only bind to it. Registering advances the
// snapshot revision, which is what tells the sidebar's panel list to re-evaluate its `label` function; without
// it nothing announces the language change and the sidebar entry stays in whichever language it started in.
// `label` is a function collected at registration, so `bind` alone cannot reach it.
const ownRegistration = localeRegistrations.find((entry) => entry.ns === moduleFace.name)
if (ownRegistration === undefined) {
  console.error('FAIL: the plugin did not register its dictionaries with the locale service')
  console.error(`      registrations seen: ${JSON.stringify(localeRegistrations)}`)
  process.exit(1)
}
const registeredLocales = [...ownRegistration.locales].sort().join(',')
if (registeredLocales !== 'en,zh') {
  console.error(`FAIL: the plugin registered locales ${JSON.stringify(ownRegistration.locales)}; expected both en and zh`)
  process.exit(1)
}
const registeredZh = localeDictionaries.get(moduleFace.name)?.get('zh') ?? {}
const registeredEn = localeDictionaries.get(moduleFace.name)?.get('en') ?? {}
const registeredKeyCount = Object.keys(registeredZh).length
if (registeredKeyCount < 100 || Object.keys(registeredEn).length !== registeredKeyCount) {
  console.error(`FAIL: the registered dictionaries look wrong (zh ${String(registeredKeyCount)}, en ${String(Object.keys(registeredEn).length)})`)
  process.exit(1)
}
// Registering bumped the revision, which is the observable that makes a re-render possible.
if (localeRevision <= 1) {
  console.error('FAIL: registering the dictionaries did not advance the locale revision')
  process.exit(1)
}

console.log('locale binding: zh ->', JSON.stringify(englishBefore), '| en ->', JSON.stringify(englishAfter))
console.log('locale fallback for an unregistered key ->', JSON.stringify(fallbackPath), '| placeholder ->', JSON.stringify(t('time.days', { count: 3 })))
console.log('english coverage:', String(referenced.size), 'key(s),', String(missingEnglish.length), 'missing')
console.log('registered with the service:', registeredLocales, `${String(registeredKeyCount)} keys, revision now ${String(localeRevision)}`)
console.log('drawer tabs zh:', JSON.stringify(chineseTabs))
console.log('drawer tabs en:', JSON.stringify(tabLabels))
console.log('OK: the client half applies under the real Cordis runtime')
