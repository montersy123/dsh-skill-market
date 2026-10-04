/**
 * Assert the render harness's observations, which it only reports.
 *
 * `render-panel.mjs` prints its findings as JSON and exits 0 whatever they say — so every claim it made during
 * this work was "observed", never "enforced". A `landmarkOrderOk: false` or `cardStatsAreIconOnly: false` sat in
 * its output while the suite still reported green, which is worse than not checking at all: it looked checked.
 *
 * This runs the harness and enforces the assertions that have a definite correct answer. Only those are listed;
 * values that describe the fixture (card counts, request lists, measured widths) are intentionally not asserted
 * here, because a fixture change would break them for no reason.
 *
 *   node scripts/verify-render.mjs [--viewport WxH]
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const viewportArg = process.argv.indexOf('--viewport')
const viewport = viewportArg >= 0 ? process.argv[viewportArg + 1] : '1440x900'

let raw
try {
  raw = execFileSync(process.execPath, [
    join(import.meta.dirname, 'render-panel.mjs'),
    // The fixture lives under `tests/`, not beside this script: it is test data, and keeping it out of `scripts/`
    // is what stops a reader mistaking it for something the plugin ships.
    '--fixture', join(import.meta.dirname, '..', 'tests', 'fixture'),
    '--viewport', viewport,
    '--interactions',
  ], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PANEL_PAGE_URL: 'dsh-app://app' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (error) {
  // A non-zero exit still carries the report on stdout, and the assertions below should run so the failure names
  // the actual problem rather than "the harness exited 1".
  raw = String(error.stdout ?? '')
  if (raw.trim() === '') {
    console.error('  FAIL: the render harness produced no output')
    console.error(String(error.stderr ?? '').slice(0, 2000))
    process.exit(1)
  }
}

const start = raw.indexOf('{')
if (start < 0) {
  console.error('  FAIL: no JSON report in the harness output')
  process.exit(1)
}
const report = JSON.parse(raw.slice(start))

/**
 * The assertions, each named and each with a definite expected value.
 *
 * Every entry here corresponds to a defect that was actually seen during this work, so the list stays a record of
 * real regressions rather than a wish list.
 */
const assertions = [
  ['the panel mounted', () => report.counts?.cards > 0],
  ['the five landmarks are direct children of the panel root', () => report.landmarkOrderOk === true],
  ['no landmark is nested inside another', () => (report.landmarkOrder ?? []).every((entry) => entry.found && entry.directChildOfRoot)],
  ['the card list scrolls, not the page', () => report.structure?.contentIsScrollable === true],
  ['the page head stays in the fixed region', () => report.structure?.headInFixed === true],
  ['the category chips stay in the fixed region', () => report.structure?.chipsInFixed === true],
  ['the card grid is inside the scrolling body', () => report.structure?.gridInContent === true],
  ['the top bar is outside the scrolling body', () => report.structure?.topbarOutsideContent === true],
  ['no element is wider than the viewport', () => (report.overflowCandidates ?? []).length === 0],
  ['the card statistics row carries no words', () => report.cardStatsAreIconOnly === true],
  ['the card statistics row has both figures as icons', () => (report.cardStats ?? []).every((row) => row.icons.includes('i-download') && row.icons.includes('i-bookmark'))],
  ['every figure still names itself in a tooltip', () => (report.cardStats ?? []).every((row) => row.titles.length === 3)],
  ['no rendered text is still a dictionary key', () => (report.untranslatedKeys ?? []).length === 0],
  ['the drawer opens on a card click', () => report.interactions?.inspectorOpen === true],
  // The drawer body must be the inspector's own child. Nested inside the header it gets no height from the flex
  // container, grows to its content height, and is clipped — which is exactly the "cannot scroll" defect.
  // Asserted as `=== true`, not `!== false`: a null (read while no drawer was open) must fail, not pass.
  ['the drawer body is a direct child of the inspector', () => report.interactions?.drawerBodyParentIsInspector === true],
  ['the drawer body is not nested inside the header', () => report.interactions?.drawerBodyInsideHead === false],
  ['the drawer has all six tabs', () => (report.interactions?.inspectorTabs ?? []).length === 6],
  ['the tabs are translated, not keys', () => (report.interactions?.inspectorTabs ?? []).every((label) => /^tab\./.test(label) === false)],
  ['the safety tab is named 安全扫描, not 安全', () => report.interactions?.safetyTabIsNotJustSafe === true],
  ['the safety tab carries the shield icon', () => report.interactions?.safetyTabHasShield === true],
  ['the safety tab tints only its icon', () => report.interactions?.safetyTabTintIsIconScoped === true],
  ['the two known labs are named, and an unknown vendor keeps its code', () => report.interactions?.detailSafetyUsesLabNames === true && report.interactions?.detailSafetyKeepsUnknownVendor === true],
  ['a local row hides the download figure', () => report.interactions?.localInstalledHasDownloads === false],
  ['a market row keeps the download figure', () => report.interactions?.marketInstalledHasDownloads === true],
  ['a local row shows no call command', () => report.interactions?.localInstalledHasCall === false],
  ['lazy loading appends the next page', () => report.interactions?.cardsAfterLoadMore > report.interactions?.cardsAfterFirstPage],
  ['the load-more control disappears at the end', () => report.interactions?.loadMoreGoneAtEnd === true],
  ['the catalogue opens sorted by downloads', () => report.interactions?.openingSortFirstOptionIsDownloads === true],
  ['every opening request asked for downloads', () => report.interactions?.everyOpeningRequestSortedByDownloads === true],
  ['the view is not restored from storage', () => report.interactions?.viewAfterReload === '发现'],
  ['the saved list survives a reload', () => report.interactions?.savedRowsAfterReload === 1],
  ['the installed lookup folds `_` against `-`', () => report.interactions?.installedLookupFoldsUnderscore === true],
  ['reconciliation trusts the Host identity, not the directory name', () => report.interactions?.reconciliationUsesHostIdentity === true],
  ['the sort control renders translated labels', () => (report.interactions?.openingSortOptionLabels ?? [])[0] === '按下载量'],
  ['the page rendered without a React error', () => (report.errors ?? []).filter((line) => line.includes('deprecated') === false).length === 0],
]

const failures = []
console.log(`  viewport: ${viewport}`)
console.log('')
for (const [label, check] of assertions) {
  let ok = false
  try {
    ok = check() === true
  } catch (error) {
    ok = false
  }
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}

console.log('')
if (failures.length === 0) {
  console.log(`RENDER OK — ${String(assertions.length)} assertion(s)`)
  process.exit(0)
}
console.error(`${String(failures.length)} RENDER ASSERTION(S) FAILED`)
process.exit(1)
