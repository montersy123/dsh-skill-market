/**
 * Run the scroll lab in headless Chrome and print the measurements.
 *
 * The lab measures layout that CSS text cannot settle: a percentage-height chain either resolves or collapses, and
 * only a real engine says which. Chrome is already on this machine, so the lab is a page plus `--dump-dom` rather
 * than a browser-automation dependency.
 *
 *   node scripts/dev/run-scroll-lab.mjs [--original] [--width 620] [--height 900]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : fallback
}
const width = flag('--width', '620')
const height = flag('--height', '900')

if (existsSync(CHROME) === false) {
  console.error(`  Chrome not found at ${CHROME}; set CHROME_PATH`)
  process.exit(1)
}

const scratch = mkdtempSync(join(tmpdir(), 'scroll-lab-'))
const buildArgs = [join(import.meta.dirname, 'build-scroll-lab.mjs'), scratch]
if (argv.includes('--original')) buildArgs.push('--original')
execFileSync(process.execPath, buildArgs, { stdio: 'inherit' })

const url = `file:///${join(scratch, 'index.html').replace(/\\/g, '/')}`
const dump = execFileSync(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--virtual-time-budget=3000',
  `--window-size=${width},${height}`,
  '--dump-dom',
  url,
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })

const dumpPath = join(scratch, 'dump.html')
writeFileSync(dumpPath, dump, 'utf8')
console.log('')
execFileSync(process.execPath, [join(import.meta.dirname, 'read-scroll-lab.mjs'), dumpPath], { stdio: 'inherit' })

rmSync(scratch, { recursive: true, force: true })
