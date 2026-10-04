/**
 * Estimate whether the drawer's tab strip fits its width in each language.
 *
 * The reported symptom was horizontal and vertical scrollbars appearing once the tabs were English, and the
 * fix chosen was shorter English labels. Whether that is *sufficient* is a measurement, not an opinion: the
 * strip is `nowrap` inside a 560px drawer, so the six labels plus their padding decide it.
 *
 * Text width cannot be measured exactly without a font engine, so this uses per-character advance estimates
 * for the interface font at 13px — close enough to tell "fits with room to spare" from "overflows", which is
 * the only distinction that matters here.
 *
 *   node scripts/tab-width-estimate.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pkg = join(import.meta.dirname, '..')
const { ZH, EN } = await import(`file://${join(pkg, 'lib', 'locale.js').replace(/\\/g, '/')}`)

const TABS = ['tab.overview', 'tab.files', 'tab.versions', 'tab.permissions', 'tab.safety', 'tab.metrics']

/** Advance widths in em for the interface font, approximated per character class. */
function estimateWidth(text, fontSizePx) {
  let em = 0
  for (const character of text) {
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(character)) em += 1.0
    else if (/[A-Z]/.test(character)) em += 0.66
    else if (/[a-z]/.test(character)) em += 0.52
    else if (/[0-9]/.test(character)) em += 0.55
    else if (character === ' ') em += 0.28
    else em += 0.4
  }
  return em * fontSizePx
}

// From the stylesheet: `.sm-tabs` has `padding: 14px 20px 0` and `gap: 2px`; `.sm-tab` has
// `padding: 9px 11px 11px`. The drawer is 560px wide, but `max-width: 94%` applies on narrow viewports.
const DRAWER_WIDTH = 560
const TABS_HORIZONTAL_PADDING = 20 * 2
const TAB_HORIZONTAL_PADDING = 11 * 2
const GAP = 2
const FONT_SIZE = 13

for (const [language, dictionary] of [['zh', ZH], ['en', EN]]) {
  const labels = TABS.map((key) => dictionary[key])
  const textWidth = labels.reduce((sum, label) => sum + estimateWidth(label, FONT_SIZE), 0)
  const chrome = TABS_HORIZONTAL_PADDING + (labels.length * TAB_HORIZONTAL_PADDING) + ((labels.length - 1) * GAP)
  const total = textWidth + chrome
  const fits = total <= DRAWER_WIDTH
  console.log(`  ${language}: ${labels.join(' | ')}`)
  console.log(`    estimated label width : ${total.toFixed(0)}px (text ${textWidth.toFixed(0)}px + chrome ${String(chrome)}px)`)
  console.log(`    drawer width          : ${String(DRAWER_WIDTH)}px`)
  console.log(`    verdict               : ${fits ? `fits, ${(DRAWER_WIDTH - total).toFixed(0)}px spare` : `OVERFLOWS by ${(total - DRAWER_WIDTH).toFixed(0)}px`}`)
  console.log('')
}

// The strip must also survive a narrower drawer: `max-width: 94%` on a small viewport.
const narrow = Math.round(390 * 0.94)
const enTotal = TABS.reduce((sum, key) => sum + estimateWidth(EN[key], FONT_SIZE), 0)
  + TABS_HORIZONTAL_PADDING + (TABS.length * TAB_HORIZONTAL_PADDING) + ((TABS.length - 1) * GAP)
console.log(`  narrow viewport (390px screen -> ${String(narrow)}px drawer): English needs ${enTotal.toFixed(0)}px, ${enTotal > narrow ? 'OVERFLOWS' : 'fits'}`)
console.log('')
console.log('  Note: at that width the strip must scroll or wrap gracefully; `overflow-x: auto` already allows')
console.log('  scrolling, but a visible scrollbar inside the drawer reads as a layout defect.')
