/**
 * Verify the landmark-order guard against synthetic DOMs, without touching the client source.
 *
 * The guard was written for a real defect: a translation edit left `header.sm-topbar` unclosed, so
 * `div.sm-viewbar` became its child. The page misaligned while every existing assertion passed, because they
 * all ask whether an element is inside the right parent and none asks whether it is outside the wrong one.
 *
 * The first two attempts at this self-test mutated the real bundle to plant the defect, and both got the
 * parenthesis surgery wrong and rewrote the file. A check that breaks the thing it checks is not worth
 * having, so the guard is now exercised on constructed DOMs instead — the same code path, no source file
 * involved.
 *
 *   node scripts/landmark-guard-selftest.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// The jsdom copy lives with the archived dev tooling. Imported by path rather than by name because it is not a
// declared dependency of this package: it is a scratch install used to run the panel without a browser.
import { JSDOM } from './dev/reactsmoke/node_modules/jsdom/lib/api.js'

// `render-panel.mjs` is a script with top-level side effects — importing it would run the whole harness and
// print its report. Its guard function is therefore extracted from the source and evaluated in isolation, so
// the logic under test is byte-identical to the logic that ships, with no side effects.
const harnessPath = join(import.meta.dirname, 'render-panel.mjs')
const harnessSource = readFileSync(harnessPath, 'utf8')
const functionStart = harnessSource.indexOf('function landmarkOrderOf(root)')
if (functionStart < 0) {
  console.error('  FAIL: landmarkOrderOf was not found in the render harness')
  process.exit(1)
}
// Walk to the closing brace of the function by counting braces from its opening one.
const bodyStart = harnessSource.indexOf('{', functionStart)
let depth = 0
let functionEnd = bodyStart
for (let index = bodyStart; index < harnessSource.length; index += 1) {
  if (harnessSource[index] === '{') depth += 1
  else if (harnessSource[index] === '}') {
    depth -= 1
    if (depth === 0) { functionEnd = index + 1; break }
  }
}
const landmarkOrderOf = new Function(
  `${harnessSource.slice(functionStart, functionEnd)}; return landmarkOrderOf`,
)()

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

/**
 * Build a panel-shaped DOM and return the landmark verdict for it.
 * @param {boolean} nestViewBarInHeader - Whether to reproduce the defect.
 * @param {boolean} dropStatusBar - Whether to omit a landmark entirely.
 * @returns {{ ok: boolean, entries: object[] }} Guard verdict.
 */
function verdictFor(nestViewBarInHeader, dropStatusBar = false) {
  const viewbar = "<div class='sm-viewbar'></div>"
  const statusbar = dropStatusBar ? '' : "<div class='sm-statusbar'></div>"
  const body = nestViewBarInHeader
    ? `<header class='sm-topbar'><div class='sm-topbar-actions'></div>${viewbar}</header>`
    : `<header class='sm-topbar'><div class='sm-topbar-actions'></div></header>${viewbar}`
  const dom = new JSDOM(`<!doctype html><html><body>
    <div data-skill-market-panel="skill-market">
      ${body}
      <div class='sm-fixed'></div>
      <main class='sm-content'></main>
      ${statusbar}
    </div>
  </body></html>`)
  return landmarkOrderOf(dom.window.document.querySelector('[data-skill-market-panel]'))
}

console.log('  the healthy structure:')
const healthy = verdictFor(false)
expect(healthy.ok === true, 'all five landmarks are direct children of the panel root')
expect(healthy.entries.every((entry) => entry.found), 'every landmark is found')
expect(healthy.entries.filter((entry) => entry.directChildOfRoot).length === 5, 'exactly five landmarks are direct children')

console.log('')
console.log('  the real defect — the view bar nested inside header.sm-topbar:')
const broken = verdictFor(true)
expect(broken.ok === false, 'the guard rejects the misaligned structure')
const viewbar = broken.entries.find((entry) => entry.className === 'sm-viewbar')
expect(viewbar.found === true, 'the view bar is still found — it is misplaced, not missing')
expect(viewbar.directChildOfRoot === false, 'the view bar is reported as not a direct child')
expect(viewbar.parentChain.includes('sm-topbar'), `the parent chain names the wrong parent (${viewbar.parentChain})`)

console.log('')
console.log('  a landmark that is absent entirely:')
const missing = verdictFor(false, true)
expect(missing.ok === false, 'the guard rejects a structure with a missing landmark')

console.log('')
console.log(failures === 0 ? 'LANDMARK GUARD SELFTEST OK' : `${String(failures)} PROBLEM(S)`)
process.exit(failures === 0 ? 0 : 1)
