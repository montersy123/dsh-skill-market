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
  // Reading a file happens in a dialog over the panel, not inside the 560px drawer: that is the whole
  // point of the change. The widths are read from the stylesheet because jsdom has no layout to measure.
  ['reading a file opens a dialog wider than the drawer', () => report.interactions?.previewDeclared?.dialogPx > report.interactions?.previewDeclared?.drawerPx],
  ['the dialog is not inside the drawer, and its layer covers the panel', () => report.interactions?.previewNotInsideDrawer === true
    && report.interactions?.previewLayerInPanelRoot === true],
  ['the dialog layer sits above the drawer', () => report.interactions?.previewDeclared?.layerZ > report.interactions?.previewDeclared?.drawerZ],
  ['the file tree stays visible behind the dialog', () => report.interactions?.previewTreeVisibleBehind === true],
  ['closing the dialog leaves the tree in place', () => report.interactions?.previewClosed === true && report.interactions?.treeRestored === true],
  ['Escape closes the dialog without closing the drawer', () => report.interactions?.escapeClosedDialog === true
    && report.interactions?.escapeKeptDrawer === true],
  // The host ships a markdown renderer and a shiki-backed code block; the dialog hands both to it, so a
  // preview has real markdown and real syntax colours instead of the plain text it used to show.
  ['markdown files render through the host markdown renderer', () => report.interactions?.previewUsesHostMarkdown === true],
  // A link's external glyph sits inside its text run. The panel sets `svg { display: block }` for its own
  // icons, which stranded that glyph on a line of its own above the link, so this is asserted explicitly.
  ['a glyph inside host markdown stays inline', () => report.interactions?.markdownGlyphDisplay === 'inline-block'],
  // The summary is markdown too, and tables appear there first — the host renderer is what keeps a
  // skill's description readable rather than literal pipes.
  ['the overview summary renders markdown through the host renderer', () => report.interactions?.overviewUsesHostMarkdown === true],
  // ...and the panel's own renderer must draw tables too, because it is the fallback when the host's is not
  // in the build. These are the exact lines from a skill document whose table rendered as literal pipes.
  ['the fallback renderer recognises a GFM table', () => {
    const rules = report.interactions?.tableRules ?? {}
    return rules.header?.cells?.length === 2
      && rules.header?.delimiter === false
      && rules.delimiter?.delimiter === true
      && (rules.delimiter?.align ?? []).length === 2
      && rules.body?.cells?.length === 2
      && rules.thematicBreak?.delimiter === false
  }],
  ['the rendered table has header, body, alignment and a one-column case', () => {
    const interactions = report.interactions ?? {}
    return JSON.stringify(interactions.tableHeads) === JSON.stringify(['目标', '资料', '单列'])
      && (interactions.tableCells ?? []).join('|') === '甲|乙|唯一'
      && interactions.tableWrapped === true
      && (interactions.tableAligns ?? [])[1] === 'center'
      && interactions.tableParagraphKept === '导语一段。'
  }],
  // A document's links point at its neighbours. The host renderer only makes those clickable through the
  // delegate provider's `openFile`, and the fallback renderer only draws them as buttons when it has a
  // handler — so both paths are asserted, plus the resolver that keeps the target inside the bundle.
  ['the dialog gives the host renderer an openFile delegate', () => report.interactions?.delegateProviderUsed === 'yes'],
  ['following a link inside the dialog opens that file and keeps it open', () => report.interactions?.dialogProbeFound === true
    && report.interactions?.pathAfterFollowedLink === 'references/deep/notes.md'
    && report.interactions?.dialogOpenAfterFollowedLink === true],
  ['a followed link can be walked back to the file it came from', () => report.interactions?.backControlBeforeLink === false
    && report.interactions?.backControlShown === true
    && report.interactions?.backControlGlyph === 'M14.5 6l-6 6 6 6'
    && report.interactions?.pathAfterBack === 'references/guide.md'
    && report.interactions?.backControlGone === true],
  // A file link is highlighted, not underlined: the accent colour alone says it goes somewhere, and a
  // permanent underline under every reference in a table is heavier than the cell's content.
  ['a file link is highlighted without an underline', () => {
    const decoration = report.interactions?.markdownFileLinkDecoration
    const rule = report.interactions?.markdownFileLinkRule ?? {}
    return (decoration === 'none' || decoration === '') && rule.accent === true && rule.border === false
  }],
  // The shell puts a file-type glyph inside a file link; the panel drops it, since the label is the content.
  ['a file link does not carry its type glyph', () => report.interactions?.fileLinkGlyphDisplay === 'none'],
  // ...and the colour is written inline as well as by rule: the cascade contest with the shell's own
  // stylesheet is not one the panel wins by specificity, since the shell ships a colour for the same class.
  ['a file link is coloured inline as well as by rule', () => /color:\s*var\(--sm-accent\)/.test(report.interactions?.fileLinkInlineColour ?? '')],
  // The shell renders markdown's elements but its stylesheet does not reach the dialog, so the panel typesets
  // them itself — which is why a preview used to look unstyled next to the same file opened in DSH.
  ['the panel typesets host markdown itself', () => {
    const rule = report.interactions?.markdownCodeRule ?? {}
    return /font-family:\s*var\(--sm-font-mono\)/.test(rule.code ?? '')
      // A neutral chip: the panel adds no accent tint of its own here.
      && /background:\s*var\(--sm-bg\)/.test(rule.code ?? '')
      && /border:/.test(rule.code ?? '')
      && /background:\s*var\(--sm-bg\)/.test(rule.pre ?? '')
  }],
  // The panel overrides the host's code palette for its own subtree: in a preview the code is the content,
  // and the host's tokens (tuned for prose) washed out. Six declarations is the palette; the string colour is
  // checked not to be the host's (#2f9e44) so this cannot pass on the inherited palette.
  ['the panel declares its own code palette', () => {
    const declared = report.interactions?.codePaletteDeclared ?? []
    return declared.length >= 6
      && declared.includes('string=#2f9e44') === false
      && declared.includes('keyword=#d6336c') === false
  }],
  ['the fallback renderer follows a link to a neighbouring file', () => report.interactions?.fallbackLinkIsButton === true
    && report.interactions?.fallbackLinkOpened === 'references/expert-topics.md'
    && report.interactions?.fallbackLinkAnchor === 'https://example.com'],
  ['a bundle link resolves only inside the bundle', () => {
    const resolved = report.interactions?.linkResolution ?? {}
    return resolved.sibling === 'references/expert-topics.md'
      && resolved.up === 'SKILL.md'
      && resolved.nested === 'references/deep/notes.md'
      && resolved.anchor === 'SKILL.md'
      && resolved.absolute === null
      && resolved.url === null
      && resolved.escape === null
  }],
  ['code files are coloured through the host highlighter', () => report.interactions?.codeFileFound === true
    && (report.interactions?.codeTokenCount ?? 0) > 0
    && (report.interactions?.codeText ?? '').includes('run.py') === false
    && report.interactions?.codePreviewClosed === true],
  // A file preview belongs to one file *of one skill*. Keyed by `<version>:<path>` alone, the second
  // skill's 文件 tab was a cache hit on the first skill's `SKILL.md` and rendered its text — the stub
  // names the skill it served, so a mix-up is visible at all.
  ['the first skill\'s file preview is its own', () => report.interactions?.firstPreviewNamesItsSkill === true],
  ['a second skill\'s file preview is its own, not the first one\'s', () => report.interactions?.secondPreviewNamesItsSkill === true
    && report.interactions?.secondPreviewLeaksAnother === false],
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
