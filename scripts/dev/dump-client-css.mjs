/**
 * Execute a dynamic-client bundle and print the stylesheet(s) it registers, so
 * the ported token table and responsive rules can be diffed against the design
 * export without opening a browser.
 *
 *   node tools/dump-client-css.mjs <bundle.js>
 */
import { readFileSync } from 'node:fs'

const bundlePath = process.argv[2]
const registrations = []
globalThis.window = {
  __ModuleLoader__: { load: (registration) => registrations.push(registration) },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
}

const sheets = []
new Function('window', 'document', 'styles', 'console', readFileSync(bundlePath, 'utf8'))(
  globalThis.window,
  { head: { appendChild() {} }, createElement: () => ({ dataset: {}, remove() {} }) },
  { insert: (css) => { sheets.push(css); return () => {} } },
  console,
)

if (registrations.length === 0) {
  console.error('bundle registered no loader entry:', bundlePath)
  process.exit(1)
}

// Running the factory is what defines the stylesheet: the CSS constant lives in
// the closure, and `apply` is what hands it to `styles.insert`.
const { createRequire } = await import('node:module')
const { join } = await import('node:path')
const { pathToFileURL } = await import('node:url')
const reactFlagIndex = process.argv.indexOf('--react')
const reactDir = reactFlagIndex >= 0 ? process.argv[reactFlagIndex + 1] : null
if (reactDir === null) {
  console.error('pass --react <node_modules dir containing react>')
  process.exit(2)
}
const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)
const React = thirdPartyRequire('react')

for (const registration of registrations) {
  const exports = registration.factory((specifier) => {
    if (specifier === 'react') return React
    throw new Error(`unsupported external: ${specifier}`)
  })
  const ctx = {
    get: () => undefined,
    provide: () => () => {},
    effect: (callback) => { const disposer = callback(); return () => { if (typeof disposer === 'function') disposer() } },
    on: () => () => {},
    slots: { inject: (key, callback) => callback(), register: () => () => {}, registerFactory: () => () => {} },
  }
  exports.apply(ctx)
}

for (const css of sheets) process.stdout.write(css + '\n')

