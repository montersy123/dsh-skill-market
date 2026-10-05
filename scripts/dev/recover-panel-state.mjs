/**
 * Recover this plugin's Local Storage document out of LevelDB.
 *
 * Kept because there is no other way back. A build that deleted the Web Storage keys before its
 * write to the Host had landed left the favorites with nowhere to live — the exact defect
 * `legacy-saved-check.mjs` case 5 now refuses — and LevelDB still held the last `Put` record: the
 * delete is a later entry, and the value is not erased until compaction rewrites the file. Rebuilding
 * this from scratch would mean re-deriving the log format under pressure, with the user's data gone.
 *
 * Chromium's Local Storage stores a key as `_<origin>\x00<key>`, and its value with a leading type
 * byte (`\x00` UTF-16, `\x01` Latin-1), which is why a plain text search does not find the JSON.
 *
 *   node scripts/dev/recover-panel-state.mjs "<user data>/Local Storage/leveldb"                 # report
 *   node scripts/dev/recover-panel-state.mjs "<…>/leveldb" "<profile>/@…/data/panel.json" --apply # restore
 *
 * The report prints the newest value of every key it recognises, so the recovery can be checked
 * before it is written. Nothing is written without `--apply`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const target = process.argv[3] ?? null
const apply = process.argv.includes('--apply')
const STATE_KEY = 'dsh-skill-market/v1'
const PENDING_KEY = 'dsh-skill-market/pending/v1'

if (dir === undefined) {
  console.error('  usage: node scripts/dev/recover-panel-state.mjs <leveldb dir> [<panel.json path> --apply]')
  process.exit(1)
}

/**
 * Read one varint32 out of a buffer.
 * @param {Buffer} source - Buffer to read from.
 * @param {number} at - Offset of the first byte.
 * @returns {{value: number, next: number}} The value and the offset after it.
 */
function readVarint(source, at) {
  let result = 0
  let shift = 0
  let cursor = at
  for (;;) {
    const byte = source[cursor]
    cursor += 1
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return { value: result >>> 0, next: cursor }
}

/**
 * Decode a Chromium Local Storage value.
 * @param {Buffer} bytes - Raw value, including its leading type byte.
 * @returns {string} The text.
 */
function decodeValue(bytes) {
  if (bytes.length === 0) return ''
  const body = bytes.subarray(1)
  return bytes[0] === 0 && body.length % 2 === 0 ? body.toString('utf16le') : body.toString('latin1')
}

/**
 * Every operation on this plugin's keys in one LevelDB file, in log order.
 *
 * Only `.log` files: an SSTable stores its entries in blocks that may be snappy-compressed, and the
 * values that matter are always in the log until the next compaction. A table built earlier holds
 * older sequence numbers than the log, so it cannot hold a newer value.
 *
 * @param {string} file - Absolute path.
 * @returns {Array<{file: string, seq: number, tag: number, key: string, value: Buffer | null}>} Operations.
 */
function scan(file) {
  const buffer = readFileSync(file)
  const found = []
  let cursor = 0
  while (cursor + 7 <= buffer.length) {
    const length = buffer.readUInt16LE(cursor + 4)
    const type = buffer[cursor + 6]
    const start = cursor + 7
    const end = start + length
    // Zeroed padding at the end of a 32 KiB block: jump to the next block boundary.
    if (length === 0 || type < 1 || type > 4 || end > buffer.length) {
      const next = (Math.floor(cursor / 32768) + 1) * 32768
      if (next <= cursor) break
      cursor = next
      continue
    }
    if (type === 1) {
      // A whole record: payload = WriteBatch = sequence(8) count(4) then the entries.
      const payload = buffer.subarray(start, end)
      if (payload.length >= 12) {
        const seq = Number(payload.readBigUInt64LE(0))
        const count = payload.readUInt32LE(8)
        let at = 12
        for (let index = 0; index < count && at < payload.length; index += 1) {
          const tag = payload[at]
          at += 1
          const keyLength = readVarint(payload, at)
          at = keyLength.next
          const key = payload.subarray(at, at + keyLength.value).toString('utf8')
          at += keyLength.value
          let value = null
          if (tag === 1) {
            const valueLength = readVarint(payload, at)
            at = valueLength.next
            value = payload.subarray(at, at + valueLength.value)
            at += valueLength.value
          }
          if (key.endsWith(STATE_KEY) || key.endsWith(PENDING_KEY)) {
            found.push({
              file: file.split(/[\\/]/).pop(),
              seq,
              tag,
              key: key.endsWith(STATE_KEY) ? 'state' : 'pending',
              value,
            })
          }
        }
      }
    }
    cursor = end
  }
  return found
}

const all = readdirSync(dir)
  .filter((name) => name.endsWith('.log'))
  .flatMap((name) => scan(join(dir, name)))
  .sort((a, b) => a.seq - b.seq)

console.log(`${String(all.length)} operation(s) on this plugin's keys, oldest first:\n`)
for (const entry of all) {
  const bytes = entry.value === null ? 0 : entry.value.length
  console.log(`  ${entry.file} seq=${entry.seq} ${entry.tag === 1 ? 'PUT   ' : 'DELETE'} ${entry.key} bytes=${String(bytes)}`)
}

/**
 * The last **value** written for a key, whatever happened after it.
 *
 * The deletes are usually the reason to run this, so they must not make it give up: the earlier
 * `Put` is still there, and it is the only surviving copy.
 *
 * @param {string} key - `state` or `pending`.
 * @returns {{seq: number, text: string} | null} The value, or null when the key was never written.
 */
function latest(key) {
  const puts = all.filter((entry) => entry.key === key && entry.tag === 1)
  const last = puts[puts.length - 1]
  return last === undefined ? null : { seq: last.seq, text: decodeValue(last.value) }
}

const state = latest('state')
if (state === null) {
  console.error('\nno state value in this log: nothing to recover')
  process.exit(1)
}
const pending = latest('pending')
const parsed = JSON.parse(state.text)

console.log(`\nnewest state value is from seq=${String(state.seq)} (${String(state.text.length)} chars):\n`)
console.log(JSON.stringify(parsed, null, 2))
console.log(`\nnewest pending value: ${pending === null ? '(never written)' : pending.text}`)

const document = {
  category: typeof parsed.category === 'string' && parsed.category !== '' ? parsed.category : 'all',
  installed: Array.isArray(parsed.installed) ? parsed.installed : [],
  saved: Array.isArray(parsed.saved) ? parsed.saved : [],
  savedSkills: parsed.savedSkills !== null && typeof parsed.savedSkills === 'object' ? parsed.savedSkills : {},
  enabled: parsed.enabled !== null && typeof parsed.enabled === 'object' ? parsed.enabled : {},
  // The advice the old build was showing is spent: reading this document at all means the Harness
  // restarted, which is what it asked for. The client retires anything older than the running Host
  // anyway; writing it empty says so outright.
  pending: { since: 0, dirs: [] },
}

if (apply === false || target === null) {
  console.log('\n(dry run; pass the target panel.json path and --apply to write)')
  process.exit(0)
}
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
console.log(`\nwrote ${target}`)
