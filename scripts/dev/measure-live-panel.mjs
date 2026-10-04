/**
 * Measure the live panel in the running GUI, instead of a reconstruction of it.
 *
 * Every reconstruction said the drawer body scrolls, so the difference has to be in something the reconstruction
 * does not reproduce: how the harness sizes the panel mount, or whether the plugin's stylesheet is present at all.
 * This opens the real URL in headless Chrome with remote debugging, asks the page for the numbers, and prints them.
 *
 * The panel only renders once its React tree mounts, and the drawer only exists after a card is clicked, so this
 * reports the shell's own measurements and whatever panel elements it can find — enough to tell "the panel is
 * shorter than the viewport" from "the stylesheet never arrived".
 *
 *   node scripts/dev/measure-live-panel.mjs [url]
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2] ?? 'http://127.0.0.1:19387/'
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9223
const scratch = mkdtempSync(join(tmpdir(), 'dsh-probe-'))

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${scratch}`,
  '--window-size=1440,1000',
  url,
], { stdio: 'ignore' })

/** Poll the DevTools endpoint until it answers. */
async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)
      if (page !== undefined) return page
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}

const page = await waitForTarget()
if (page === null) {
  chrome.kill()
  rmSync(scratch, { recursive: true, force: true })
  console.error('  could not reach the DevTools endpoint')
  process.exit(1)
}

const expression = `(() => {
  const lines = []
  const push = (label, node) => {
    if (!node) { lines.push(label + ' :: MISSING'); return }
    const s = getComputedStyle(node)
    lines.push([label,
      'client=' + node.clientHeight,
      'scroll=' + node.scrollHeight,
      'overflowY=' + s.overflowY,
      'height=' + s.height,
      'flex=' + s.flex,
    ].join(' '))
  }
  push('documentElement', document.documentElement)
  push('body           ', document.body)
  push('panel          ', document.querySelector('[data-skill-market]'))
  push('main   .sm-content', document.querySelector('.sm-content'))
  push('drawer .sm-inspector', document.querySelector('.sm-inspector'))
  push('drawer body    ', document.querySelector('.sm-insp-body'))
  push('drawer head    ', document.querySelector('.sm-insp-head'))
  const sheets = [...document.querySelectorAll('style')].map((s) => s.textContent.length)
  lines.push('style tags       :: ' + sheets.length + '  sizes=' + sheets.join(','))
  lines.push('has panel CSS    :: ' + [...document.querySelectorAll('style')].some((s) => s.textContent.includes('sm-insp-body')))
  lines.push('viewport         :: ' + window.innerWidth + 'x' + window.innerHeight)
  // Walk up from the panel so the chain that supplies its height is visible.
  let node = document.querySelector('[data-skill-market]')
  while (node && node !== document.body) {
    const s = getComputedStyle(node)
    lines.push('ancestor         :: ' + node.tagName.toLowerCase() + '.' + (node.className || '(none)')
      + ' height=' + s.height + ' display=' + s.display + ' client=' + node.clientHeight)
    node = node.parentElement
  }
  return lines.join('\\n')
})()`

// Drive the CDP session over a WebSocket using only the standard library.
const { WebSocket } = await import('node:worker_threads').then(() => ({ WebSocket: globalThis.WebSocket }))
if (WebSocket === undefined) {
  chrome.kill()
  rmSync(scratch, { recursive: true, force: true })
  console.error('  this Node build has no global WebSocket; cannot drive CDP')
  process.exit(1)
}

const socket = new WebSocket(page.webSocketDebuggerUrl)
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP timed out')), 20000)
  socket.addEventListener('open', () => {
    // Give the page a moment to mount the panel before asking.
    setTimeout(() => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: false },
      }))
    }, 2500)
  })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id !== 1) return
    clearTimeout(timer)
    if (message.result?.exceptionDetails) {
      reject(new Error(message.result.exceptionDetails.text ?? 'evaluation failed'))
      return
    }
    resolve(message.result?.result?.value ?? '(no value)')
  })
  socket.addEventListener('error', () => reject(new Error('CDP socket error')))
})

console.log(String(result).split('\n').map((line) => `  ${line}`).join('\n'))

socket.close()
chrome.kill()
rmSync(scratch, { recursive: true, force: true })
