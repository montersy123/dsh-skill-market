/**
 * Find where the stylesheet template literal really starts and ends, and why an extraction stopped early.
 *
 * The scroll guard reported 264 rules and missed a rule that is definitely in the file, so the slice it worked on
 * was not the whole stylesheet. This locates every backtick and every `CSS =` assignment so the boundary is known
 * rather than assumed.
 *
 *   node scripts/dev/find-stylesheet-bounds.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'client.js'), 'utf8')
console.log(`  file length: ${String(source.length)}`)

const BACKTICK = 96
const ticks = []
for (let index = 0; index < source.length; index += 1) {
  if (source.charCodeAt(index) === BACKTICK) ticks.push(index)
}
console.log(`  backticks in the file: ${String(ticks.length)}`)

const assignments = []
const pattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*`/g
let match
while ((match = pattern.exec(source)) !== null) {
  assignments.push({ name: match[1], tickAt: match.index + match[0].length - 1 })
}
console.log('')
console.log('  template-literal assignments:')
for (const assignment of assignments) {
  console.log(`    ${assignment.name.padEnd(22)} opens at ${String(assignment.tickAt)}`)
}

// What the checker's regex picks up, and where the next backtick after it falls.
const marker = /(?:const|let)\s+CSS\s*=\s*`/
const found = marker.exec(source)
console.log('')
if (found === null) {
  console.log('  the checker regex /(?:const|let)\\s+CSS\\s*=\\s*`/ does not match')
} else {
  const start = found.index + found[0].length
  const end = source.indexOf('`', start)
  console.log(`  checker start  : ${String(start)}`)
  console.log(`  checker end    : ${String(end)}   (length ${String(end - start)})`)
  console.log(`  first line     : ${JSON.stringify(source.slice(start, start + 70))}`)
  console.log(`  content at end : ${JSON.stringify(source.slice(end - 90, end + 10))}`)
  const inside = source.slice(start, end)
  console.log('')
  console.log(`  does that slice contain .sm-preview-code? ${String(inside.includes('.sm-preview-code'))}`)
  console.log(`  does the FILE contain .sm-preview-code?   ${String(source.includes('.sm-preview-code'))}`)
  const inFile = source.indexOf('.sm-preview-code')
  console.log(`  its offset in the file : ${String(inFile)}  (checker end was ${String(end)})`)
}

// Any backtick inside the declared range tells us the slice closed early.
console.log('')
console.log('  identifiers named CSS:')
const names = [...source.matchAll(/\bCSS\b/g)].slice(0, 8).map((entry) => entry.index)
console.log(`    ${names.join(', ')}`)
