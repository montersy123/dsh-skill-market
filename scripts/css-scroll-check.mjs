/**
 * Guard the drawer's scroll contract.
 *
 * The drawer is a full-height flex column whose single scroll region is `.sm-insp-body`. Two rules keep that
 * true, and both are easy to break from a distance because neither shows up in a diff as anything alarming:
 *
 *   1. No descendant of the drawer may size itself against the *viewport*. The drawer is only as tall as the
 *      plugin panel, so `60vh` is unrelated to the space it actually occupies. `.sm-preview-code` carried
 *      `max-height: 60vh; overflow: auto` and became a second scroll container that clipped long files at a
 *      boundary which looked like the end of the content.
 *   2. Nothing inside the body may introduce a nested vertical scroller. Because this app hides scrollbars by
 *      design, a nested one is invisible: the wheel only moves it while the pointer is over that exact box, so
 *      the panel reads as frozen.
 *
 *   node scripts/css-scroll-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8')
const failures = []
const notes = []

/**
 * Pull the stylesheet out of the template literal.
 *
 * Comments are stripped so a class name mentioned inside one is never read as a rule.
 * @returns {string} CSS with comments removed.
 */
function stylesheet() {
  const marker = /(?:const|let)\s+CSS\s*=\s*`/
  const found = marker.exec(source)
  if (found === null) {
    failures.push('could not locate the stylesheet template literal')
    return ''
  }
  const start = found.index + found[0].length
  const end = source.indexOf('`', start)
  if (end < 0) {
    failures.push('the stylesheet template literal is unterminated')
    return ''
  }
  return source.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '')
}

const css = stylesheet()

/** Every `selector { declarations }` pair in the stylesheet. */
function rules() {
  const found = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(css)) !== null) {
    found.push({ selector: match[1].trim().replace(/\s+/g, ' '), body: match[2] })
  }
  return found
}

const all = rules()
if (all.length === 0 && failures.length === 0) failures.push('no CSS rules were parsed')

// ── the drawer's own subtree, by class name ──
// Any selector mentioning one of these is inside the panel, so its declarations are in scope. The panel's own rule
// is excluded: the panel legitimately takes its height from the viewport, and it is the thing the drawer lives in.
const DRAWER = /\.sm-(inspector|insp-head|insp-body|insp-meta|insp-pub|insp-actions|tabs|tab|tree|preview|versions|perm|stat-strip|md)\b/
/** Whether a selector targets the drawer rather than the panel that contains it. */
const inDrawer = (selector) => DRAWER.test(selector) && /^\[data-skill-market\]$/.test(selector.trim()) === false

const VIEWPORT_UNIT = /(?:^|[\s:(,])\d*\.?\d+(?:vh|vw|vmin|vmax|dvh|svh|lvh|dvw)\b/

for (const { selector, body } of all) {
  if (inDrawer(selector) === false) continue

  // 1. no viewport-relative sizing inside the drawer. The panel takes its height from the viewport on purpose —
  //    a percentage of an indefinite mount is what squeezed this drawer's body to 40px — but nothing below the
  //    panel may, because the drawer is only as tall as the panel and 60vh there is unrelated to its own space.
  for (const declaration of body.split(';')) {
    const [property, value = ''] = declaration.split(':')
    if (property === undefined || value === '') continue
    if (VIEWPORT_UNIT.test(value)) {
      failures.push(`${selector} sizes "${property}" against the viewport (${value.trim()}) — the drawer is only as tall as the panel, so use the body's own scroll instead`)
    }
  }

  // 2. nothing but the body itself may scroll vertically
  if (selector.includes('.sm-insp-body')) continue
  for (const declaration of body.split(';')) {
    const [property, value = ''] = declaration.split(':')
    if (property === undefined) continue
    const name = property.trim()
    const text = value.trim()
    if (name === 'overflow' && /(^|\s)(auto|scroll)(\s|$)/.test(text)) {
      failures.push(`${selector} declares "overflow: ${text}" inside the drawer — that is a nested scroll region, and this app hides scrollbars, so it is invisible`)
    }
    if (name === 'overflow-y' && /^(auto|scroll)$/.test(text)) {
      failures.push(`${selector} declares "overflow-y: ${text}" inside the drawer — a nested vertical scroller is invisible here (scrollbars are hidden by design)`)
    }
    if (name === 'max-height' && /%|vh|dvh|svh/.test(text)) {
      notes.push(`${selector} caps height at ${text}; fine only while it stays relative to its own box`)
    }
  }
}

// ── the contract itself must still be declared ──
// The panel takes its height from the viewport, not from its mount. Measured: with `height: 100%` against an
// indefinite mount the panel came out at 178px — shorter than its own 224px header — and the body below it was
// squeezed to 40px, which reads as "cannot scroll". Both unit spellings must be present so an engine without dvh
// still gets a definite height from the vh line above it.
// There are two rules whose selector is exactly `[data-skill-market]`: the first declares the token table, the
// second the layout. Picking the first by selector alone silently asserted against a block of CSS variables, so the
// layout rule is found by a declaration only it carries.
const panel = all.find((rule) => rule.selector === '[data-skill-market]' && /flex-direction:\s*column/.test(rule.body))
if (panel === undefined) {
  failures.push('[data-skill-market] has no layout rule, so the panel has no height contract at all')
} else {
  if (/height:\s*100(vh|dvh)/.test(panel.body) === false) {
    failures.push('the panel must take its height from the viewport (height: 100vh with a 100dvh override) — a percentage resolves to auto against a content-sized mount, which squeezes the drawer body to an unusable height')
  }
  if (/height:\s*100dvh/.test(panel.body) === false) {
    failures.push('the panel should override 100vh with 100dvh, so a collapsing mobile toolbar cannot clip it')
  }
  if (/min-height:\s*0/.test(panel.body) === false) {
    failures.push('the panel must keep min-height: 0, or it will refuse to shrink inside a flex mount')
  }
  if (/overflow-y:\s*auto/.test(panel.body) === false) {
    failures.push('the panel should keep overflow-y: auto as a backstop, so a mount shorter than the viewport scrolls instead of clipping the panel contents')
  }
}

// ── the drawer's scroll region ──
const body = all.find((rule) => rule.selector === '[data-skill-market] .sm-insp-body')
if (body === undefined) {
  failures.push('.sm-insp-body has no rule — the drawer has no scroll region at all')
} else {
  const declarations = body.body
  if (/overflow-y:\s*auto/.test(declarations) === false) {
    failures.push('.sm-insp-body no longer declares "overflow-y: auto", so the drawer cannot scroll')
  }
  if (/min-height:\s*0/.test(declarations) === false) {
    failures.push('.sm-insp-body no longer declares "min-height: 0" — as a flex child it will grow to fit its content instead of scrolling')
  }
  if (/flex:\s*1/.test(declarations) === false) {
    failures.push('.sm-insp-body no longer declares "flex: 1", so it will not fill the space under the header')
  }
}

// Selector lookup is by class name alone, NOT by `.name {`. The rule parser splits on the brace, so the captured
// selector never contains one — a lookup that required it matched nothing and its assertion silently never ran.
const drawer = all.find((rule) => rule.selector.includes('.sm-inspector'))
if (drawer === undefined) {
  failures.push('.sm-inspector has no rule, so the head/body split has nothing to work with')
} else if (/flex-direction:\s*column/.test(drawer.body) === false) {
  failures.push('.sm-inspector is no longer a column flex container, which the head/body split depends on')
}

// The header must not shrink. Measured with the real stylesheet in a standalone page: with the default
// 0 1 auto a short drawer compresses the header instead of letting the body scroll, and the header then clips its
// own contents. The body is the one element allowed to give.
const head = all.find((rule) => rule.selector === '[data-skill-market] .sm-insp-head')
if (head === undefined) {
  failures.push('.sm-insp-head has no rule')
} else if (/flex:\s*0\s+0\s+auto/.test(head.body) === false) {
  failures.push('.sm-insp-head must declare "flex: 0 0 auto" — otherwise a short drawer shrinks the header instead of scrolling the body, and the header clips its own contents')
}

const drawerRules = all.filter((rule) => inDrawer(rule.selector))
console.log(`  ${String(all.length)} CSS rules parsed; ${String(drawerRules.length)} inside the drawer`)
console.log('')
for (const note of notes) console.log(`  note  ${note}`)
if (notes.length > 0) console.log('')

if (failures.length === 0) {
  console.log('  DRAWER SCROLL CONTRACT OK — one scroll region, nothing sized against the viewport')
  process.exit(0)
}
console.log(`  ${String(failures.length)} problem(s):`)
for (const failure of failures) console.log(`    - ${failure}`)
process.exit(1)
