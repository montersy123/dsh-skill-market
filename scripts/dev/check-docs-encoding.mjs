/**
 * Verify the documentation in the committed tree is valid UTF-8 and renders as intended.
 *
 * PowerShell's output pipeline renders UTF-8 CJK as mojibake, so a console that shows `鐨勬妧鑳藉競鍦? cannot be
 * trusted either way. These files are about to be the repository's public face, so this decodes the bytes
 * strictly, reports the first line of each, and fails on anything that is not clean UTF-8.
 *
 *   node scripts/dev/check-docs-encoding.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const files = [
  'README.md',
  'README.en.md',
  'docs/development.md',
  'docs/skillhub-api.md',
  'LICENSE',
  'package.json',
  'locale/zh.json',
  'locale/en.json',
]

let failures = 0
for (const relative of files) {
  const path = join(root, relative)
  const bytes = readFileSync(path)
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    console.error(`  FAIL ${relative}: not valid UTF-8 (${error.message})`)
    failures += 1
    continue
  }
  // U+FFFD only appears when bytes decoded with loss, which is what a GBK round-trip leaves behind.
  const replacement = text.includes('\uFFFD')
  const firstLine = text.split('\n').find((line) => line.trim() !== '') ?? ''
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const bad = replacement ? ' U+FFFD PRESENT' : ''
  console.log(`  ${relative}`)
  console.log(`    bytes ${String(bytes.length)}, CJK ${String(cjk)}, first line: ${firstLine.slice(0, 64)}${bad}`)
  if (replacement) failures += 1
}

// And the same content, written to a file, so it can be compared without a console in the way.
console.log('')
if (failures === 0) {
  console.log('DOCS ENCODING OK')
  process.exit(0)
}
console.error(`${String(failures)} FILE(S) NOT CLEAN UTF-8`)
process.exit(1)
