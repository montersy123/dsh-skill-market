/**
 * Load a dynamic-client bundle exactly the way the shell's module loader does:
 * create a fake `window`, capture the `__ModuleLoader__.load` registration, then
 * materialise the factory with a `require` table backed by whatever React copy
 * is reachable on this machine. Only syntax and top-level evaluation are
 * validated here — nothing renders.
 *
 *   node tools/check-client.mjs <bundle.js> [--react <dir-with-react>]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const bundlePath = process.argv[2]
if (bundlePath === undefined) {
  console.error('usage: node tools/check-client.mjs <bundle.js> [--react <dir>]')
  process.exit(2)
}

/** Find a React copy: explicit flag, profile node_modules, or the DSH payload. */
function resolveReact(flagDir) {
  const candidates = []
  if (flagDir !== undefined) candidates.push(flagDir)
  candidates.push(process.env.DSH_PROFILE_DIR ? join(process.env.DSH_PROFILE_DIR, 'node_modules') : null)
  candidates.push(join(process.env.DSH_HOME ?? '', 'profiles', process.env.DSH_PROFILE ?? '', 'node_modules'))
  for (const dir of candidates) {
    if (dir === null || dir === undefined || dir === '') continue
    const reactDir = join(dir, 'react')
    if (existsSync(join(reactDir, 'package.json'))) return reactDir
  }
  return null
}

const args = process.argv.slice(3)
const reactFlagIndex = args.indexOf('--react')
const reactDir = resolveReact(reactFlagIndex >= 0 ? args[reactFlagIndex + 1] : undefined)
if (reactDir === null) {
  console.error('no React copy found; pass --react <node_modules dir containing react>')
  process.exit(2)
}
const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)

/** Collected registrations, mirroring the loader queue. */
const registrations = []
/** `<style>` tags the bundle injects, collected for the report. */
const styleTags = []

globalThis.window = {
  __ModuleLoader__: {
    mode: 'queue',
    pendingQueue: registrations,
    load(registration) { registrations.push(registration) },
  },
  localStorage: {
    getItem() { return null },
    setItem() {},
  },
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  addEventListener() {},
  removeEventListener() {},
}

const requireTable = (specifier) => {
  if (specifier === 'react') return thirdPartyRequire('react')
  if (specifier === 'react/jsx-runtime') return thirdPartyRequire('react/jsx-runtime')
  throw new Error(`unexpected external import in a dynamic bundle: "${specifier}"`)
}

const source = readFileSync(bundlePath, 'utf8')
const module = { exports: {} }
// A dynamic bundle is a classic script: only `window`, `document` and `require`
// reach it. No `styles` global is provided, because the shipped shell has none —
// a bundle that reaches for one must fail here rather than only in the page.
// eslint-disable-next-line no-new-func
new Function(
  'window', 'document', 'console',
  source,
)(
  globalThis.window,
  { head: { appendChild: (tag) => styleTags.push(tag) }, createElement: () => ({ dataset: {}, textContent: '', remove() {} }) },
  console,
)

if (registrations.length !== 1) {
  console.error(`expected exactly one loader registration, saw ${registrations.length}`)
  process.exit(1)
}
const registration = registrations[0]
console.log('registration id:', registration.id)

const React = requireTable('react')
const exports = registration.factory((specifier) => {
  if (specifier === 'react') return React
  throw new Error(`factory requested unsupported external: "${specifier}"`)
})

/** Minimal Cordis-ish client context for `apply`. */
const applied = []
const ctx = {
  get: () => undefined,
  provide() { return () => {} },
  effect(callback) { const disposer = callback(); applied.push(disposer); return () => { if (typeof disposer === 'function') disposer() } },
  on() { return () => {} },
  slots: {
    inject(key, callback) { applied.push(callback) },
    register(declaration, component) {
      if (typeof declaration?.name !== 'string') throw new Error('registration needs a slot name')
      if (typeof component !== 'function') throw new Error('registration needs a component function: ' + declaration.name)
      return () => {}
    },
    registerFactory() { return () => {} },
  },
}

if (typeof exports.apply !== 'function') throw new Error('client half exports no apply()')
exports.apply(ctx)

console.log('plugin name:', exports.name)
console.log('inject:', JSON.stringify(exports.inject ?? []))
console.log('stylesheet <style> tags:', styleTags.length, 'chars:', styleTags.map((tag) => String(tag.textContent ?? '').length).join(','))
console.log('slot injections captured:', applied.length)

// Render every registered component once with React's server renderer, so a
// component body that throws on first render fails here instead of blanking the
// user's panel.
const { renderToStaticMarkup } = (() => {
  for (const name of ['react-dom/server']) {
    try { return thirdPartyRequire(name) } catch { /* keep looking */ }
  }
  return {}
})()

const captured = []
const captureCtx = {
  ...ctx,
  slots: {
    inject(key, callback) { callback() },
    register(declaration, component) { captured.push({ declaration, component }); return () => {} },
    registerFactory() { return () => {} },
  },
}
// Re-run apply with the capturing slot registry.
exports.apply(captureCtx)

if (typeof renderToStaticMarkup !== 'function') {
  console.log('react-dom/server unavailable — skipped render smoke test')
} else {
  for (const { declaration, component } of captured) {
    const props = { usePanelInfo: () => ({ getSnapshot: () => ({ activePanelId: declaration.key ?? declaration.id }) }) }
    const markup = renderToStaticMarkup(React.createElement(component, props))
    console.log(`rendered <${declaration.name}> (${declaration.key ?? declaration.id}): ${markup.length} chars`)
  }
}

console.log('OK')
