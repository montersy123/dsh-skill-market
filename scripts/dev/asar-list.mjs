import { readFileSync } from 'node:fs'

const ASAR = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const buf = readFileSync(ASAR)

// asar header: pickle
// uint32 size of next payload (always 4), uint32 headerPickleSize, uint32 ... then JSON
const headerSize = buf.readUInt32LE(4)
const headerStr = buf.toString('utf8', 16, 8 + headerSize)
const header = JSON.parse(headerStr)

const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null
const out = []
function walk (node, path) {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const p = path + '/' + name
    if (child.files) walk(child, p)
    else out.push([p, child.size ?? 0])
  }
}
walk(header, '')

const hits = out.filter(([p]) => !filter || filter.test(p))
console.log('total files:', out.length, 'matches:', hits.length)
for (const [p, s] of hits.slice(0, 400)) console.log(String(s).padStart(9), p)
