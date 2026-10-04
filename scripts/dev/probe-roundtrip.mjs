/**
 * Probe the GBK round-trip against one real damaged line, to find where the
 * reconstruction fails.
 *
 *   node tools/probe-roundtrip.mjs <file> <line>
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const profileModules = join(process.env.USERPROFILE ?? '', '.dsh', 'profiles', 'desktop', 'node_modules')
const require = createRequire(pathToFileURL(join(profileModules, 'noop.js')).href)
const iconv = require('iconv-lite')

const target = process.argv[2]
const lineNumber = Number.parseInt(process.argv[3] ?? '1', 10)
const line = readFileSync(target, 'utf8').split('\n')[lineNumber - 1]

// The whole non-ASCII run, greedily, with no ASCII allowed inside.
const runs = line.match(/[^\x00-\x7F]+/g) ?? []
console.log('runs found:', runs.length)

for (const run of runs.slice(0, 3)) {
  console.log('  run length:', run.length)
  try {
    const bytes = iconv.encode(run, 'gbk')
    console.log('  gbk bytes:', bytes.length)
    const decoded = new TextDecoder('utf8', { fatal: true }).decode(bytes)
    console.log('  decoded  :', JSON.stringify(decoded))
  } catch (error) {
    console.log('  FAILED   :', error.message)
    // Show which byte sequence is not valid UTF-8, to see how far it gets.
    const bytes = iconv.encode(run, 'gbk')
    for (let index = 0; index < bytes.length; index += 1) {
      try {
        new TextDecoder('utf8', { fatal: true }).decode(bytes.subarray(0, index + 1))
      } catch {
        console.log('  first bad prefix length:', index + 1, 'byte:', bytes[index].toString(16))
        break
      }
    }
  }
}
