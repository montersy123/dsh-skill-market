/**
 * Check the install's build fingerprint.
 *
 * `GET /build` exists so that a panel that looks unchanged can be diagnosed from outside: it reports which host
 * build answered and which client file the installed package actually holds. Those numbers are only useful if
 * they are true, so the hash is compared with the file it claims to describe, and the marker the panel prints
 * when its own typography fails is required to be present in that file.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFingerprintForTest } from '../lib/index.js'

const root = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/i, '')
const failures = []

const fingerprint = await buildFingerprintForTest()
console.log(`  host build: ${String(fingerprint.hostBuild)}`)
console.log(`  package version: ${String(fingerprint.version)}`)
console.log(`  client: ${String(fingerprint.client?.bytes)} bytes, ${String(fingerprint.client?.sha256)}`)

if (typeof fingerprint.hostBuild !== 'string' || fingerprint.hostBuild.trim() === '') {
  failures.push('the host half did not report a build marker')
}

const packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
if (fingerprint.version !== packageVersion) {
  failures.push(`the reported version ${String(fingerprint.version)} is not package.json's ${String(packageVersion)}`)
}

const bytes = await readFile(join(root, 'lib', 'client.js'))
const expected = createHash('sha256').update(bytes).digest('hex')
if (fingerprint.client?.sha256 !== expected) {
  failures.push('the reported client hash does not match lib/client.js on disk')
}
if (fingerprint.client?.bytes !== bytes.byteLength) {
  failures.push('the reported client size does not match lib/client.js on disk')
}
if (fingerprint.client?.hasBuildMarker !== true) {
  failures.push('lib/client.js does not carry the build marker the panel reports when its styles fail')
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`)
  process.exit(1)
}
console.log('  BUILD FINGERPRINT OK')
