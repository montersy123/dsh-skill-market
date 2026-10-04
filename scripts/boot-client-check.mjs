/**
 * Reproduce the shell's client-plugin arrival + materialisation with the REAL
 * kernel code (`@deepseek-ai/dsh-client-modules/lib/client.js`, the browser
 * half). The only stub is the script transport: a row's `/plugins/...` URL is
 * served by reading that package's `exports["./client"]` file from disk.
 *
 * This is the check that matters before an app restart: it uses the same
 * `arrive` / `register` / `materialize` path the page uses, so any failure here
 * is the text the renderer would record as `importError(id)` and then report as
 * `web boot: 1 entry did not activate`.
 *
 *   node tools/boot-client-check.mjs <package-name> [<package-name> ...]
 */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ASAR_OUT = resolve('scripts/dev/asar-out')
const KERNEL = join(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js')
const REACT_DIR = resolve('scripts/dev/reactsmoke/node_modules')

if (!existsSync(KERNEL)) {
  console.error(`missing kernel copy at ${KERNEL}; extract it with scripts/asar-extract.mjs first`)
  process.exit(2)
}

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('usage: node tools/boot-client-check.mjs <package-name> [...]')
  process.exit(2)
}

const thirdPartyRequire = createRequire(pathToFileURL(join(REACT_DIR, 'package.json')).href)

/** Package roots a profile-installed or shipped bundle can resolve from. */
const roots = [
  process.env.DSH_PROFILE_DIR === undefined ? null : join(process.env.DSH_PROFILE_DIR, 'node_modules'),
  join(ASAR_OUT, 'dsh/node_modules'),
].filter((root) => root !== null && existsSync(root))

/**
 * Resolve one package to its manifest and client bundle.
 * @param {string} name - Package name.
 * @returns {{name: string, dir: string, bundle: string, decl: object}} Package facts.
 */
function resolvePackage(name) {
  for (const root of roots) {
    const dir = join(root, name)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    if (pkg.name !== name) continue
    const clientRel = typeof pkg.exports?.['./client'] === 'string'
      ? pkg.exports['./client']
      : pkg.exports?.['./client']?.default
    if (clientRel === undefined) throw new Error(`${name} declares no ./client export`)
    const bundle = join(dir, clientRel)
    if (!existsSync(bundle)) throw new Error(`${name} client bundle missing: ${bundle}`)
    return { name, dir, bundle, decl: pkg.dsh?.client ?? {} }
  }
  throw new Error(`cannot resolve package ${name} from ${roots.join(', ')}`)
}

const rows = targets.map(resolvePackage)

/** Collect the `<style>` tags the bundle registers, for the report only. */
const styleTags = []
globalThis.window = {
  __ModuleLoader__: { mode: 'queue', pendingQueue: [], load(registration) { this.pendingQueue.push(registration) } },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout, clearTimeout,
  addEventListener() {}, removeEventListener() {},
}
globalThis.document = {
  head: { appendChild: (tag) => styleTags.push(tag) },
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  querySelectorAll: () => [],
  querySelector: () => null,
}
// Deliberately NO `globalThis.styles`: the shipped shell hands a dynamic bundle
// only `window`, `document` and `require`, so a bundle that reaches for another
// free global must fail here, not only in the page.

// Materialise the kernel bundle exactly as the parser-blocking bootstrap script does.
new Function('window', 'document', 'console', readFileSync(KERNEL, 'utf8'))(
  globalThis.window, globalThis.document, console,
)
const kernelRegistration = globalThis.window.__ModuleLoader__.pendingQueue
  .find((registration) => registration.id === '@deepseek-ai/dsh-client-modules')
if (kernelRegistration === undefined) throw new Error('the kernel bundle registered no entry')
const kernelExports = kernelRegistration.factory(() => { throw new Error('the kernel requested an external') })

/** The platform seed table: React is the one external a UI bundle may request. */
const React = thirdPartyRequire('react')
const staticModules = {
  react: React,
  'react/jsx-runtime': thirdPartyRequire('react/jsx-runtime'),
  'react-dom': thirdPartyRequire('react-dom'),
}

/** Row URL -> bundle file, so the script transport can serve it. */
const urlToFile = new Map()
const graph = {
  rev: 'local',
  entries: rows.map((row, index) => {
    const url = `plugins/${row.name}/client.js?rev=local${index}`
    urlToFile.set(url, row.bundle)
    return {
      id: row.name,
      url,
      rev: `local${index}`,
      ...(row.decl.inject === undefined ? {} : { inject: row.decl.inject }),
      ...(row.decl.external === undefined ? {} : { external: row.decl.external }),
      ...(row.decl.immediately === true ? { immediately: true } : {}),
    }
  }),
  batches: [{
    phase: 'application',
    url: `plugins/??${rows.map((row) => `${row.name}/client.js`).join(',')}&rev=local`,
    rev: 'local',
    entries: rows.map((row) => row.name),
  }],
}

/** The shell's classic-script loader, replaced by a disk reader. */
const loadBundle = async (url) => {
  const mapping = urlToFile.get(url)
  if (mapping === undefined) throw new Error(`no transport mapping for ${url}`)
  // A batch URL carries several bundles in one classic script, exactly like the
  // Host's combo response; a single-resource URL carries exactly one.
  const files = Array.isArray(mapping) ? mapping : [mapping]
  for (const file of files) {
    new Function('window', 'document', 'console', readFileSync(file, 'utf8'))(
      globalThis.window, globalThis.document, console,
    )
  }
}

// The batch URL is the one the group requests first; serve it as a combo.
urlToFile.set(graph.batches[0].url, rows.map((row) => row.bundle))

/** The facade: the same object the bootstrap switches to live registration. */
const facade = {
  mode: 'queue',
  pendingQueue: globalThis.window.__ModuleLoader__.pendingQueue.filter((registration) => registration !== kernelRegistration),
  load(registration) { facade.pendingQueue.push(registration) },
}
// Bundles reference `window.__ModuleLoader__`, so both names must be this object.
globalThis.window.__ModuleLoader__ = facade

const system = kernelExports.createClientModuleSystem(
  facade,
  { id: '@deepseek-ai/dsh-client-modules', exports: kernelExports },
  { boot: graph, staticModules, loadBundle },
)

/** A Cordis-shaped client context, enough for `apply` to run for real. */
function makeContext(name) {
  const registered = []
  const ctx = {
    name,
    get: () => undefined,
    provide: () => () => {},
    reflect: { provide: () => () => {} },
    on: () => () => {},
    effect: (callback) => {
      const disposer = callback()
      return () => { if (typeof disposer === 'function') disposer() }
    },
    slots: {
      inject: (key, callback) => { callback(); return () => {} },
      register: (declaration, component) => {
        if (typeof declaration?.name !== 'string') throw new Error(`registration for ${name} needs a slot name`)
        if (typeof component !== 'function') throw new Error(`registration for ${name} needs a component function`)
        registered.push(`${declaration.name}${declaration.key === undefined ? '' : `[${declaration.key}]`}${declaration.id === undefined ? '' : `[${declaration.id}]`}`)
        return () => {}
      },
      registerFactory: () => () => {},
    },
  }
  return { ctx, registered }
}

let failures = 0
for (const row of rows) {
  const { ctx, registered } = makeContext(row.name)
  try {
    const mod = await system.import(row.name)
    if (typeof mod?.apply !== 'function') throw new Error('exports no apply()')
    if (Array.isArray(mod.inject) === false) throw new Error('exports no inject list')
    mod.apply(ctx)
    console.log(`ok   ${row.name}: inject=${JSON.stringify(mod.inject)} slots=${JSON.stringify(registered)} styleTags=${styleTags.length} css=${styleTags.reduce((sum, tag) => sum + String(tag.textContent ?? '').length, 0)}`)
  } catch (error) {
    failures += 1
    const recorded = system.importError?.(row.name)
    console.error(`FAIL ${row.name}: ${error instanceof Error ? error.message : String(error)}`)
    if (recorded !== undefined && recorded !== error) console.error(`     importError(): ${recorded.message}`)
  }
}

/* ── the shell's own boot audit, as `entries.start(loader, manifest)` runs it ──
 * This is the exact code path whose result becomes
 * `web boot: 1 entry did not activate`. The stubs below stand in for a little
 * of Cordis: the Loader's dynamic `plugin()` and the per-row exception handler
 * the app boot installs.
 */
const rowStates = new Map()
const rowFailures = []
const entriesById = new Map()
const auditLoader = {
  ctx: {
    effect: (callback) => { const disposer = callback(); return () => { if (typeof disposer === 'function') disposer() } },
    loader: {
      /**
       * Mirror Cordis' `ctx.plugin` for one already-imported module: its `apply`
       * runs with a row context, and a throw fails that fiber.
       * @param {object} spec - `{ name, apply }` module face.
       * @returns {object} The fiber-shaped tracking object.
       */
      plugin(spec) {
        rowStates.set(spec.name, 1)
        try {
          spec.apply(makeContext(spec.name).ctx)
          rowStates.set(spec.name, 2)
        } catch (error) {
          rowStates.set(spec.name, 3)
          rowFailures.push({ name: spec.name, error })
        }
        return { entry: { options: { name: spec.name } }, inject: {}, state: rowStates.get(spec.name) }
      },
    },
  },
  ensureId: (options) => options.name,
  async create(options) {
    const mod = await system.import(options.name)
    auditLoader.ctx.loader.plugin({ name: options.name, apply: mod.apply })
  },
  resolve: (entryId) => entriesById.get(entryId) ?? { id: entryId, fiber: { state: rowStates.get(entryId) ?? 3 } },
  remove() {},
  async await() { return undefined },
}
for (const row of rows) {
  entriesById.set(row.name, { id: row.name, fiber: { state: 1, await: async () => undefined } })
}

const audit = await system.entries.start(auditLoader, {
  modules: graph.entries,
  plugins: rows.map((row) => ({ id: row.name })),
})
const auditedFailures = []
for (const row of rows) {
  const state = rowStates.get(row.name)
  if (state !== 2) {
    const recorded = system.importError(row.name)
    auditedFailures.push(`${row.name}: ${recorded === undefined ? `state ${String(state)}` : recorded.message}`)
  }
}
console.log(`\nboot audit (entries.start): ${auditedFailures.length === 0 ? 'all entries active' : auditedFailures.join(' | ')}`)
if (auditedFailures.length > 0) failures += auditedFailures.length
if (rowFailures.length > 0) {
  for (const failure of rowFailures) console.error(`audit apply failure ${failure.name}: ${failure.error.message}`)
}

console.log(failures === 0 ? `\nALL ${rows.length} ROW(S) ACTIVATED` : `\n${failures} ROW(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)

