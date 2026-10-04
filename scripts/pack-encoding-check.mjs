/**
 * Check whether `npm pack` preserves the UTF-8 bytes of the package's locale files.
 *
 * The installed copy of `locale/zh.json` holds mojibake (`鎶€鑳藉競鍦?`) while the same file in the checkout and
 * the Chinese in `package.json` are both intact. `package.json` survives because npm parses and re-serialises
 * it as JSON, so its bytes are rewritten knowingly; a file that is merely copied should be byte-identical.
 * This packs the package, extracts the locale files, and compares their bytes with the source.
 *
 *   node scripts/pack-encoding-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkg = join(import.meta.dirname, '..')
const scratch = mkdtempSync(join(tmpdir(), 'dsh-pack-'))

try {
  // `npm` is a .cmd shim on Windows, so it cannot be spawned directly by execFileSync. Its progress output
  // goes to stderr, so the tarball is located by listing the destination rather than by parsing stdout.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npm, ['pack', '--pack-destination', scratch], {
    cwd: pkg,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  const tarballs = readdirSync(scratch).filter((name) => name.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    console.error(`  FAIL: expected one tarball, found ${JSON.stringify(tarballs)}`)
    process.exit(1)
  }
  const tarball = join(scratch, tarballs[0])
  console.log(`  tarball: ${tarballs[0]}`)

  // Extract just the locale files. `tar` ships with Windows 10+ and with Git for Windows.
  execFileSync('tar', ['-xzf', tarball, '-C', scratch], { stdio: 'pipe' })
  const extracted = join(scratch, 'package', 'locale')

  let problems = 0
  for (const name of ['zh.json', 'en.json']) {
    const sourcePath = join(pkg, 'locale', name)
    const packedPath = join(extracted, name)
    if (existsSync(packedPath) === false) {
      console.error(`  FAIL ${name} is missing from the tarball`)
      problems += 1
      continue
    }
    const sourceBytes = readFileSync(sourcePath)
    const packedBytes = readFileSync(packedPath)
    const identical = Buffer.compare(sourceBytes, packedBytes) === 0
    console.log(`  ${name}: source ${String(sourceBytes.length)} B, packed ${String(packedBytes.length)} B, byte-identical: ${String(identical)}`)
    if (identical === false) {
      console.error(`    source: ${JSON.stringify(new TextDecoder('utf-8').decode(sourceBytes).slice(0, 80))}`)
      console.error(`    packed: ${JSON.stringify(new TextDecoder('utf-8').decode(packedBytes).slice(0, 80))}`)
      problems += 1
    }
  }

  console.log('')
  if (problems === 0) {
    console.log('PACK ENCODING OK — `npm pack` copies the locale files byte for byte')
  } else {
    console.log(`${String(problems)} FILE(S) CHANGED BY npm pack`)
  }
  process.exitCode = problems === 0 ? 0 : 1
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
