/**
 * Generate the client bundle's inline locale block from `lib/locale.js`.
 *
 * The client half is a classic script handed only `require('react')` — the module loader resolves
 * platform seed words and registered factories, with no filesystem — so it cannot `require` the
 * ESM locale module. The dictionaries therefore have to be *inside* the bundle. Copying them by hand
 * would create two sources of truth that drift silently, so they are generated, and `locale-check.mjs`
 * plus a bundle assertion keep the generated copy honest.
 *
 *   node scripts/inline-client-locale.mjs [--check]
 *
 * `--check` verifies the bundle is current and exits non-zero when it is not, so the suite can catch a
 * dictionary edit that was never inlined.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pkg = join(import.meta.dirname, '..')
const localePath = join(pkg, 'lib', 'locale.js')
const clientPath = join(pkg, 'lib', 'client.js')

const BEGIN = '    /* ── generated locale block — edit lib/locale.js and run scripts/inline-client-locale.mjs ── */'
const END = '    /* ── end generated locale block ────────────────────────────────────── */'

/** Read the two dictionaries by evaluating the module's object literals. */
async function readDictionaries() {
  const module = await import(`file://${localePath.replace(/\\/g, '/')}`)
  return { ZH: module.ZH, EN: module.EN, NS: module.NS }
}

/** Render one dictionary as an indented JS object literal, sorted so the output is stable. */
function renderDictionary(name, dictionary) {
  const keys = Object.keys(dictionary).sort()
  const entries = keys.map((key) => {
    // JSON.stringify produces a valid JS string literal for any content, including quotes and newlines.
    return `      ${JSON.stringify(key)}: ${JSON.stringify(dictionary[key])},`
  })
  return `    const ${name} = {\n${entries.join('\n')}\n    }`
}

const { ZH, EN, NS } = await readDictionaries()
const block = [
  BEGIN,
  `    const CLIENT_NS = ${JSON.stringify(NS)}`,
  renderDictionary('ZH', ZH),
  renderDictionary('EN', EN),
  '',
  '    /** Installed by apply(); falls back to Chinese so a missing service still renders text. */',
  "    let clientLocale = null",
  '',
  '    /**',
  '     * Substitute `{name}` placeholders, leaving unknown ones visible so a slip shows in the UI.',
  '     * @param {string} template - Text with placeholders.',
  '     * @param {object} [params] - Values.',
  '     * @returns {string} Formatted text.',
  '     */',
  '    function formatText(template, params) {',
  '      if (params === undefined) return template',
  "      return String(template).replace(/\\{(\\w+)\\}/g, (whole, key) => (",
  '        Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole',
  '      ))',
  '    }',
  '',
  '    /**',
  '     * Translate one key through the active language.',
  '     *',
  '     * Uses the DSH locale service when `apply()` has wired one, and the shipped dictionaries',
  '     * otherwise — a harness, or a build without the client locale package. The service answers with',
  '     * the key itself for an unregistered namespace, which is detected and replaced by the dictionary',
  '     * so a partial registration cannot fill the panel with `card.install`.',
  '     *',
  '     * @param {string} key - Dictionary key.',
  '     * @param {object} [params] - Placeholder values.',
  '     * @returns {string} Translated text.',
  '     */',
  '    function t(key, params) {',
  '      const dictionary = clientActive === \'en\' ? EN : ZH',
  '      if (clientLocale !== null) {',
  '        const text = clientLocale(key, params)',
  '        if (text !== key) return text',
  '      }',
  '      return formatText(dictionary[key] ?? ZH[key] ?? key, params)',
  '    }',
  '',
  '    /** Which shipped dictionary to prefer when no service is wired. */',
  "    let clientActive = 'zh'",
  '',
  '    /**',
  '     * The locale tag to hand to `toLocaleDateString` / `toLocaleString`.',
  '     *',
  '     * Numbers and dates are formatted at the call site, before the value reaches a dictionary, so no',
  '     * entry has to know about grouping or date order. Without it the panel grouped digits as Chinese',
  '     * inside an English UI.',
  '     *',
  '     * @returns {string} A BCP 47 tag.',
  '     */',
  '    function uiLocale() {',
  "      return clientActive === 'en' ? 'en-US' : 'zh-CN'",
  '    }',
  '',
  '    /**',
  '     * Translate a category key, falling back to the name upstream sent.',
  '     * @param {string} key - Category key from the API.',
  '     * @param {string} fallback - Upstream display name.',
  '     * @returns {string} Localised name.',
  '     */',
  '    function translatedCategory(key, fallback) {',
  '      const dictionaryKey = `category.${key}`',
  '      const translated = t(dictionaryKey)',
  '      return translated === dictionaryKey ? fallback : translated',
  '    }',
  END,
].join('\n')

const source = readFileSync(clientPath, 'utf8')
// Locate the block by the marker's *stem*, not its full text. Matching the exact string is what allowed a
// duplicate: rewriting the path inside the marker changed the needle while the file still held the old text, so
// the generator found nothing and appended a second block — and two blocks declare `CLIENT_NS` twice, which stops
// the bundle parsing. The stem carries no path, so it cannot drift with one.
const BEGIN_STEM = '/* ── generated locale block'
const END_STEM = '/* ── end generated locale block'

/** Byte offset of a whole-line marker, or -1. Whole lines only: an edit mid-line is how this broke before. */
function markerOffset(text, stem, from = 0) {
  const at = text.indexOf(stem, from)
  if (at < 0) return -1
  const lineStart = text.lastIndexOf('\n', at) + 1
  const lineEnd = text.indexOf('\n', at)
  return { lineStart, lineEnd: lineEnd < 0 ? text.length : lineEnd }
}

const beginMarker = markerOffset(source, BEGIN_STEM)
const endMarker = beginMarker < 0 ? -1 : markerOffset(source, END_STEM, beginMarker.lineEnd)

let updated
if (beginMarker !== -1 && endMarker !== -1) {
  // Before replacing anything, verify that what lies between the markers really is the generated block. A marker
  // that drifts, or a stray marker inside the code, would otherwise make this scan swallow whatever sits between
  // them — a plant test during development did exactly that, deleting real code and passing `--check` afterwards
  // because the result was self-consistent. The test is deliberately narrow: generated lines are indented key
  // entries, the two `dict` lines, the namespace constant, comments and blank lines. Anything else means the
  // markers do not bound the block, and the file is left alone.
  const blockText = source.slice(beginMarker.lineStart, endMarker.lineEnd)
  const suspicious = blockText.split('\n').filter((line) => {
    const trimmed = line.trim()
    // Blank lines, comments and the generated dictionary entries.
    if (trimmed === '' || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) return false
    if (/^"[^"]+":\s*".*",$/.test(trimmed)) return false
    // The block's own declarations and the small helpers it carries — all of which the generator writes itself.
    if (/^(const (ZH|EN|CLIENT_NS) =|let clientLocale|let clientActive|\}|function (t|formatText|uiLocale|translatedCategory)\(|return |if \(|const text|const dictionary|const translated|Object\.prototype|\/\*)/.test(trimmed)) return false
    if (/^[{}()[\];,]*$/.test(trimmed)) return false
    return true
  })
  if (suspicious.length > 0) {
    console.error(`  FAIL: ${String(suspicious.length)} line(s) between the block markers are not generated content:`)
    for (const line of suspicious.slice(0, 5)) console.error(`    ${line.trim().slice(0, 90)}`)
    console.error('  refusing to write; the markers do not bound the locale block')
    process.exit(1)
  }
  updated = source.slice(0, beginMarker.lineStart) + block + source.slice(endMarker.lineEnd)
} else if (beginMarker !== -1 || endMarker !== -1) {
  console.error('  FAIL: exactly one of the two block markers is present; refusing to guess')
  process.exit(1)
} else {
  // First run: place the block right after the shared constants so every consumer is below it.
  const anchor = "    const PANEL_ID = 'skill-market'"
  const anchorAt = source.indexOf(anchor)
  if (anchorAt < 0) throw new Error('could not find the anchor to insert the locale block after')
  const insertAt = anchorAt + anchor.length
  updated = `${source.slice(0, insertAt)}\n\n${block}${source.slice(insertAt)}`
}

// Refuse to write a file with more than one block. A generator that can double the code it manages is worse than
// no generator, and this is cheap to assert on the result rather than on the input.
const blockCount = updated.split(BEGIN_STEM).length - 1
if (blockCount !== 1) {
  console.error(`  FAIL: the result would hold ${String(blockCount)} locale blocks; refusing to write`)
  console.error('  run scripts/dev/dedupe-locale-block.mjs first')
  process.exit(1)
}

// And refuse to shrink the file materially. Duplicating the block was one failure mode; the other is consuming
// code between two markers, which leaves a self-consistent file that passes every marker check while whole
// functions are gone. A generated block adds a few hundred lines, so a large drop means something was eaten.
const sizeDelta = updated.length - source.length
const minimumDelta = -(source.length * 0.02)
if (sizeDelta < minimumDelta) {
  console.error(`  FAIL: the result is ${String(Math.abs(sizeDelta))} bytes smaller than the input; refusing to write`)
  console.error('  this is the shape of a marker scan that consumed code between two markers')
  process.exit(1)
}

// The written file must still be valid JavaScript. This is the ground truth both other guards approximate.
try {
  new Function(updated)
} catch (error) {
  console.error(`  FAIL: the result does not parse as JavaScript: ${error.message}`)
  process.exit(1)
}

const current = source === updated
if (process.argv.includes('--check')) {
  console.log(current
    ? '  client locale block is current'
    : '  client locale block is STALE — run node scripts/inline-client-locale.mjs')
  process.exit(current ? 0 : 1)
}

if (current) {
  console.log('  already current')
} else {
  writeFileSync(clientPath, updated, 'utf8')
  console.log(`  wrote the block (${Object.keys(ZH).length} zh + ${Object.keys(EN).length} en keys)`)
}
