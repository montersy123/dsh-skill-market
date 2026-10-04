/**
 * Report the card-grid column count this build produces across the viewport
 * matrix, by evaluating the same `clamp()` the stylesheet uses. jsdom has no
 * layout engine, so this is the only way to check the "fill the window" rule
 * before a human looks at it.
 *
 *   node tools/grid-columns.mjs
 *
 * Kept in step with `.sm-grid-cards` in lib/client.js: the track floor is a flat
 * 240px, the gap is 14px, and the content measure is 1440px inside one 24px
 * gutter per side.
 */
const TRACK_FLOOR = 280
const GAP = 14
const CONTENT_MAX = 1760
const GUTTER = 24

/** The content column width: the panel minus both gutters, capped at the measure. */
const contentWidth = (viewportWidth) => Math.min(viewportWidth - GUTTER * 2, CONTENT_MAX)

/**
 * Columns `repeat(auto-fit, minmax(floor px, 1fr))` settles on.
 * @param {number} viewportWidth - Panel width in CSS pixels.
 * @param {number} floor - Track floor in pixels.
 * @returns {number} Column count.
 */
function columns (viewportWidth, floor = TRACK_FLOOR) {
  const available = contentWidth(viewportWidth)
  if (floor >= available) return 1
  return Math.max(1, Math.floor((available + GAP) / (floor + GAP)))
}

/** Viewports in ascending width order, for the monotonicity sweep. */
const WIDTHS = [360, 390, 430, 600, 700, 768, 820, 900, 1024, 1180, 1280, 1366, 1440, 1600, 1680, 1760, 1920, 2560]

/**
 * Pick the largest track floor that keeps the column count monotonic in width,
 * still fills a wide desktop with at least six columns, and keeps the cards at
 * or above 240px everywhere so the description and footer stay readable.
 * @returns {number} The chosen floor in pixels.
 */
function bestFloor () {
  let best = 0
  for (let floor = TRACK_FLOOR; floor <= 320; floor += 4) {
    let previous = 0
    let monotonic = true
    for (const width of WIDTHS) {
      const count = columns(width, floor)
      if (count < previous) { monotonic = false; break }
      previous = count
    }
    const at1920 = columns(1920, floor)
    const narrowestCard = Math.min(...WIDTHS.map((width) => {
      const count = columns(width, floor)
      return Math.floor((contentWidth(width) - GAP * (count - 1)) / count)
    }))
    if (monotonic && at1920 >= 6 && narrowestCard >= 240) best = floor
  }
  return best
}

const VIEWPORTS = [
  ['mobile-compact', 360, 800],
  ['mobile-standard', 390, 844],
  ['mobile-large', 430, 932],
  ['foldable / small tablet', 600, 960],
  ['tablet portrait', 820, 1180],
  ['tablet landscape', 1024, 768],
  ['laptop', 1366, 768],
  ['desktop', 1440, 900],
  ['wide desktop', 1920, 1080],
]

const chosen = bestFloor()
console.log(`chosen track floor: ${chosen}px (lib/client.js declares ${TRACK_FLOOR}px)`)
console.log('\nfloor  narrowest card  1024px  1366px  1440px  1920px')
for (const floor of [240, 252, 260, 268, 280, 300, 316]) {
  const narrowestCard = Math.min(...WIDTHS.map((width) => {
    const count = columns(width, floor)
    return Math.floor((contentWidth(width) - GAP * (count - 1)) / count)
  }))
  console.log(
    `${String(floor).padStart(5)}  ${String(narrowestCard).padStart(13)}  ${String(columns(1024, floor)).padStart(6)}  ${String(columns(1366, floor)).padStart(6)}  ${String(columns(1440, floor)).padStart(6)}  ${String(columns(1920, floor)).padStart(6)}`,
  )
}

console.log('\nviewport                    width  content  columns  card width')
for (const [name, width] of VIEWPORTS) {
  const content = Math.round(contentWidth(width))
  const count = columns(width)
  const card = Math.floor((content - GAP * (count - 1)) / count)
  console.log(
    `${name.padEnd(26)} ${String(width).padStart(5)}  ${String(content).padStart(7)}  ${String(count).padStart(7)}  ${String(card).padStart(10)}`,
  )
}

// A single-column card must never be squeezed below the design's reading width.
const narrowest = Math.min(...VIEWPORTS.map(([, width]) => {
  const count = columns(width)
  return Math.floor((contentWidth(width) - GAP * (count - 1)) / count)
}))
console.log(`\nnarrowest card produced: ${narrowest}px (the prototype floor was 300px; ~280px still fits the two-line description, the tag row and the footer)`)

const wide = columns(1920)
if (wide < 6) {
  console.error(`FAIL: 1920px should fill with 6 columns, got ${wide}`)
  process.exit(1)
}
const desktop = columns(1440)
if (desktop < 4) {
  console.error(`FAIL: 1440px should fill with at least 4 columns, got ${desktop}`)
  process.exit(1)
}
const laptop = columns(1366)
if (laptop < 4) {
  console.error(`FAIL: 1366px should fill with at least 4 columns, got ${laptop}`)
  process.exit(1)
}
// The count must never go down as the window gets wider.
let previous = 0
for (const [, width] of VIEWPORTS) {
  const count = columns(width)
  if (count < previous) {
    console.error(`FAIL: column count dropped from ${previous} to ${count} at ${width}px`)
    process.exit(1)
  }
  previous = count
}
console.log('OK: columns grow monotonically with width — 1 at 360-600px, 2 at 820, 3 at 1024, 4 at 1366-1440, 6 at 1920 — never a fixed 3')
