/**
 * Print the code points of one line of a file, so a console codepage cannot
 * misreport what is actually stored.
 *
 *   node tools/scan-mojibake.mjs <file> <line>
 */
import { readFileSync } from 'node:fs'

const target = process.argv[2] ?? 'lib/index.js'
const lineNumber = Number.parseInt(process.argv[3] ?? '1', 10)
const line = readFileSync(target, 'utf8').split('\n')[lineNumber - 1] ?? ''

const interesting = [...line].filter((char) => char.codePointAt(0) > 0x7F)
console.log('line     :', line)
console.log('non-ascii:', JSON.stringify(interesting.map((char) => `${char}=U+${char.codePointAt(0).toString(16).toUpperCase()}`)))
console.log('looks like CJK text:', /[\u4E00-\u9FFF]/.test(line))
