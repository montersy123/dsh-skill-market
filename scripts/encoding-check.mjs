/**
 * Report whether this package's own text files are valid UTF-8.
 *
 * PowerShell's text pipeline renders UTF-8 as mojibake on this machine, which has already produced
 * false reports of "damaged" files. Node reads the bytes, so this is the reliable check — and a
 * damaged package.json would ship a broken manifest.
 *
 *   node scripts/encoding-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const files = [
  'package.json',
  'locale/zh.json',
  'locale/en.json',
  'README.md',
  'cordis.patch.yml',
]

let bad = 0
for (const relative of files) {
  const path = join(root, relative)
  let bytes
  try {
    bytes = readFileSync(path)
  } catch (error) {
    console.log(`  MISSING  ${relative} — ${error.message}`)
    bad += 1
    continue
  }
  const text = bytes.toString('utf8')
  const valid = Buffer.from(text, 'utf8').equals(bytes)
  const replacements = (text.match(/\uFFFD/g) ?? []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
  console.log(
    `  ${valid && replacements === 0 ? 'ok  ' : 'BAD '} ${relative.padEnd(20)}`
    + `${String(bytes.length).padStart(7)} B  cjk=${String(cjk).padStart(4)}`
    + `${bom ? '  BOM' : ''}${valid ? '' : '  INVALID UTF-8'}`,
  )
  if (valid === false || replacements > 0) bad += 1
}

console.log('')
// The manifest's own Chinese strings, printed so a mojibake payload cannot hide behind "valid UTF-8".
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
console.log('  package.json description :', manifest.description)
console.log('  package.json meta.title  :', manifest.meta?.title)
console.log('  locale/zh.json title     :', JSON.parse(readFileSync(join(root, 'locale/zh.json'), 'utf8')).title)
console.log('')
console.log(bad === 0 ? 'ENCODING OK' : `${bad} FILE(S) DAMAGED`)
process.exit(bad === 0 ? 0 : 1)
