/**
 * Node module resolver hooks that read `app.asar` directly, so the kernel,
 * Cordis, and anything they import can be loaded straight from the DSH
 * installation without extracting the tree first.
 *
 * A filesystem copy wins when one exists under `scripts/dev/asar-out` (a few packages
 * are extracted because other tools read them as text); otherwise the request is
 * answered from the archive and materialised on first use.
 *
 * See `asar-resolver.mjs` for the `--import` entry point.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// The extracted runtime copies and the scratch jsdom install live with the archived dev tooling under
// `scripts/dev/`, not beside this file. Pointing at `HERE/asar-out` and `HERE/reactsmoke` silently fell back to
// reading `app.asar` directly, so the checks passed while never exercising the extracted copies at all.
const EXTRACTED = join(HERE, 'dev', 'asar-out', 'dsh', 'node_modules')
const PROFILE = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh', 'profiles', process.env.DSH_PROFILE ?? 'desktop', 'node_modules')
const REACT_DIR = join(HERE, 'dev', 'reactsmoke', 'node_modules')
const ASAR = 'D:\\Program Files\\DeepSeek Harness\\resources\\app.asar'
const ASAR_PREFIX = '/dsh/node_modules/'

/** Lazily-opened archive: header tree, byte offset of data, and the bytes. */
let archive = null

/** Open the archive once and keep its header tree in memory. */
function openArchive () {
  if (archive !== null) return archive
  const buffer = readFileSync(ASAR)
  const headerSize = buffer.readUInt32LE(4)
  const header = JSON.parse(buffer.toString('utf8', 16, 8 + headerSize))
  archive = { header, dataOffset: 8 + headerSize, buffer }
  return archive
}

/**
 * Read one file out of the archive.
 * @param {string} asarPath - Path inside the archive, e.g. `/dsh/node_modules/x/index.js`.
 * @returns {Buffer | null} File bytes, or null when absent or a directory.
 */
function readFromArchive (asarPath) {
  const { header, dataOffset, buffer } = openArchive()
  let node = header
  for (const part of asarPath.split('/').filter(Boolean)) {
    node = node?.files?.[part]
    if (node === undefined) return null
  }
  if (node === null || node === undefined || node.files !== undefined) return null
  const start = dataOffset + Number(node.offset)
  return buffer.subarray(start, start + node.size)
}

/** Candidate entry files for one package directory, honouring `exports`/`main`. */
function entryCandidates (dir) {
  const candidates = []
  const manifest = join(dir, 'package.json')
  if (existsSync(manifest)) {
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    const raw = pkg.exports?.['.']?.default ?? pkg.exports?.['.']
    if (typeof raw === 'string') candidates.push(join(dir, raw))
    const entry = typeof raw === 'string' ? null : pkg.module ?? pkg.main
    if (typeof entry === 'string') candidates.push(join(dir, entry))
  }
  candidates.push(join(dir, 'index.js'), join(dir, 'index.mjs'), join(dir, 'lib/index.js'))
  return candidates
}

/**
 * Resolve a bare specifier, preferring an extracted copy and falling back to the
 * archive.
 * @param {string} specifier - Bare specifier.
 * @returns {{file: string} | {archivePath: string} | null} Resolution, or null to defer.
 */
function resolveSpecifier (specifier) {
  const scoped = specifier.startsWith('@')
  const parts = specifier.split('/')
  const name = scoped ? parts.slice(0, 2).join('/') : parts[0]
  const subpath = scoped ? parts.slice(2).join('/') : parts.slice(1).join('/')

  for (const root of [EXTRACTED, PROFILE, REACT_DIR]) {
    const dir = join(root, name)
    if (!existsSync(dir)) continue
    if (subpath !== '') {
      const base = join(dir, subpath)
      for (const candidate of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js'), join(dir, 'lib', `${subpath}.js`)]) {
        if (existsSync(candidate) && !existsSync(join(candidate, 'package.json'))) return { file: candidate }
      }
      continue
    }
    const found = entryCandidates(dir).find((candidate) => existsSync(candidate) && !existsSync(join(candidate, 'package.json')))
    if (found !== undefined) return { file: found }
  }

  const base = `${ASAR_PREFIX}${name}`
  const manifest = readFromArchive(`${base}/package.json`)
  if (manifest === null) return null
  if (subpath !== '') {
    for (const candidate of [`${base}/${subpath}`, `${base}/${subpath}.js`, `${base}/${subpath}.mjs`, `${base}/${subpath}/index.js`, `${base}/lib/${subpath}.js`]) {
      if (readFromArchive(candidate) !== null) return { archivePath: candidate }
    }
    return null
  }
  const pkg = JSON.parse(manifest.toString('utf8'))
  const raw = pkg.exports?.['.']?.default ?? pkg.exports?.['.']
  const candidates = []
  if (typeof raw === 'string') candidates.push(raw)
  const entry = typeof raw === 'string' ? null : pkg.module ?? pkg.main
  if (typeof entry === 'string') candidates.push(entry)
  candidates.push('index.js', 'index.mjs', 'lib/index.js')
  for (const candidate of candidates) {
    const path = `${base}/${String(candidate).replace(/^\.\//, '')}`
    if (readFromArchive(path) !== null) return { archivePath: path }
  }
  return null
}

/** Materialise one archived file under `scripts/dev/asar-out` so Node can load it. */
function materialize (archivePath) {
  const bytes = readFromArchive(archivePath)
  if (bytes === null) throw new Error(`asar: ${archivePath} vanished between lookup and read`)
  const target = join(EXTRACTED, archivePath.slice(ASAR_PREFIX.length))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
  return target
}

export async function resolve (specifier, context, nextResolve) {
  if (specifier.startsWith('.') || specifier.startsWith('node:') || specifier.startsWith('file:') || specifier.startsWith('data:')) {
    return nextResolve(specifier, context)
  }
  const hit = resolveSpecifier(specifier)
  if (hit === null) return nextResolve(specifier, context)
  if ('file' in hit) return { url: pathToFileURL(hit.file).href, shortCircuit: true }
  return { url: pathToFileURL(materialize(hit.archivePath)).href, shortCircuit: true }
}
