import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ASAR = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const buf = readFileSync(ASAR)
const headerSize = buf.readUInt32LE(4)
const header = JSON.parse(buf.toString('utf8', 16, 8 + headerSize))
const dataOffset = 8 + headerSize

function lookup (p) {
  const parts = p.split('/').filter(Boolean)
  let node = header
  for (const part of parts) {
    node = node.files?.[part]
    if (!node) return null
  }
  return node
}

const targets = process.argv.slice(2)
const OUT = 'D:\\DshProjects\\dsh-plugin-design\\scripts\\dev\\asar-out'
for (const t of targets) {
  const node = lookup(t)
  if (!node) { console.log('MISS', t); continue }
  if (node.files) { console.log('DIR ', t); continue }
  const start = dataOffset + Number(node.offset)
  const content = buf.subarray(start, start + node.size)
  const dest = join(OUT, t)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, content)
  console.log('OK  ', t, node.size)
}
