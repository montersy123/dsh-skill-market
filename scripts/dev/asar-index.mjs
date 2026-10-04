import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ASAR = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const buf = readFileSync(ASAR)
const headerSize = buf.readUInt32LE(4)
const header = JSON.parse(buf.toString('utf8', 16, 8 + headerSize))
const dataOffset = 8 + headerSize

const out = []
function walk (node, path) {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const p = path + '/' + name
    if (child.files) walk(child, p)
    else out.push([p, child.size ?? 0, Number(child.offset)])
  }
}
walk(header, '')
writeFileSync('D:\\DshProjects\\dsh-plugin-design\\scripts\\dev\\asar-index.json', JSON.stringify(out))

const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null
const hits = out.filter(([p]) => !filter || filter.test(p))
console.log('matches:', hits.length)
for (const [p, s] of hits.slice(0, 500)) console.log(String(s).padStart(9), p)
