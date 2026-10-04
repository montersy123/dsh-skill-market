/**
 * Rasterise the panel's icon glyphs to a PNG so they can be checked by eye.
 *
 * Icon correctness is not something a path string can settle: a stroke path can be well-formed and
 * still look like a scribble. This rebuilds each glyph at a legible size with the panel's own stroke
 * settings and writes one sheet.
 *
 *   node scripts/render-icons.mjs [out.png] [name...]
 *
 * Uses Pillow only. There is no SVG renderer in the bundled Python, so the path data is parsed here:
 * curves are flattened to short segments, which is exactly right for judging a 24×24 icon.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const clientSource = readFileSync(
  join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
)

// The glyph table is an object literal of plain strings. It references the Icon parameter `i`, so a
// stub is needed before it can be evaluated.
const tableStart = clientSource.indexOf('const PATHS = {')
const tableEnd = clientSource.indexOf('\n    }', tableStart)
if (tableStart < 0 || tableEnd < 0) throw new Error('could not locate the glyph table')
const i = 'M0 0'
// eslint-disable-next-line no-eval
const PATHS = eval(`(${clientSource.slice(tableStart + 'const PATHS = '.length, tableEnd + 6)})`)

const out = process.argv[2] ?? join(import.meta.dirname, 'icons.png')
const requested = process.argv.slice(3).filter((name) => name.startsWith('i-'))
const names = requested.length > 0 ? requested : Object.keys(PATHS)
const missing = names.filter((name) => PATHS[name] === undefined)
if (missing.length > 0) throw new Error(`not in the glyph table: ${missing.join(', ')}`)

const payload = {
  out,
  // Wide enough for a legible sheet, plus a strip at the panel's real 17px so fine detail can be
  // judged where it actually matters — an icon that only reads at 104px is not usable at 17px.
  cell: 104,
  columns: 6,
  actualPixelSizes: [17, 22],
  names,
  paths: names.map((name) => PATHS[name]),
}
const payloadPath = join(import.meta.dirname, 'icons-payload.json')
writeFileSync(payloadPath, JSON.stringify(payload), 'utf8')

const rasteriser = join(import.meta.dirname, 'rasterise-icons.py')
const result = spawnSync(process.env.DSH_PYTHON ?? 'python', [rasteriser, payloadPath], { encoding: 'utf8' })
process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
process.exit(result.status ?? 0)
