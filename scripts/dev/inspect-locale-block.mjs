/**
 * Report the generated-block markers in the client bundle, and whether any code was lost.
 *
 * Written as a file because the previous inline check kept getting mangled by PowerShell quoting. It exists
 * because of a real scare: a deliberately planted *second* marker was consumed by the generator along with the
 * code between it and the block's end marker, leaving one apparently-valid block. Whether code was destroyed is
 * the question, so the file's shape is printed rather than a single verdict.
 *
 *   node scripts/dev/inspect-locale-block.mjs [file]
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2] ?? 'lib/client.js'
const source = readFileSync(path, 'utf8')
const lines = source.split('\n')

const count = (needle) => source.split(needle).length - 1

console.log(`  file              : ${path}`)
console.log(`  lines             : ${String(lines.length)}`)
console.log(`  bytes             : ${String(source.length)}`)
console.log('')
console.log(`  BEGIN stems       : ${String(count('/* ── generated locale block'))}`)
console.log(`  END stems         : ${String(count('/* ── end generated locale block'))}`)
console.log(`  CLIENT_NS decls   : ${String(count('const CLIENT_NS'))}`)
console.log(`  ZH object decls   : ${String(count('const ZH = {'))}`)
console.log(`  EN object decls   : ${String(count('const EN = {'))}`)
console.log(`  PANEL_ID decls    : ${String(count("const PANEL_ID = '"))}`)
console.log(`  module face       : ${String(count('window.__ModuleLoader__.load'))}`)
console.log('')

// The consumers that must survive: if the generator ate code, one of these would be missing.
const markers = [
  ['const PANEL_ID', 'the panel id constant'],
  ['function t(key, params)', 'the translator'],
  ['function insertStylesheet', 'the stylesheet installer'],
  ['return {', 'the module face'],
  ['inject: [\'slots\', \'locale\']', 'the declared injection'],
]
for (const [needle, label] of markers) {
  console.log(`  ${source.includes(needle) ? 'ok  ' : 'MISSING'} ${label}`)
}

console.log('')
console.log('  marker lines:')
for (const [index, line] of lines.entries()) {
  if (line.includes('generated locale block') || line.includes('const CLIENT_NS')) {
    console.log(`    L${String(index + 1).padStart(5)}  ${line.trim().slice(0, 96)}`)
  }
}
