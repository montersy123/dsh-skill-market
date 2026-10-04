/**
 * Build a standalone page that reproduces the plugin panel's shell and the details drawer.
 *
 * The panel's scroll behaviour cannot be reasoned about from CSS alone: it depends on a chain of percentage
 * heights that either resolves against a definite parent or collapses to content, and the difference is invisible
 * in a diff. So the real stylesheet is loaded and the real drawer markup is built, and Chrome measures it.
 *
 * The shell is deliberately faithful to what the harness provides: a mount whose height is definite (100vh), the
 * `[data-skill-market]` div inside it, then the drawer. The script prints one line per element with its
 * clientHeight, scrollHeight and computed overflow, plus a verdict.
 *
 *   node scripts/dev/build-scroll-lab.mjs <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2] ?? join(import.meta.dirname, 'scroll-lab')
// `--original` restores the rule that was removed, so the two states can be measured side by side rather than argued about.
const useOriginal = process.argv.includes('--original')
// The shell variant matters. With `height: 100vh` the mount is definite whatever its ancestors do; with
// `height: 100%` it is definite only if every ancestor is, and a percentage that cannot resolve becomes `auto` —
// which is the difference between a panel that scrolls and one that grows and is clipped.
const shellIndex = process.argv.indexOf('--shell')
const shell = shellIndex >= 0 ? process.argv[shellIndex + 1] : 'vh'
mkdirSync(outDir, { recursive: true })

// Extract the stylesheet exactly as the runtime receives it, comments stripped the same way the guard strips them.
const source = readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'client.js'), 'utf8')
const marker = /(?:const|let)\s+CSS\s*=\s*`/
const found = marker.exec(source)
const start = found.index + found[0].length
const end = source.indexOf('`', start)
let css = source.slice(start, end)
if (useOriginal) {
  css = css.replace('padding: 12px 14px; overflow-x: auto;', 'padding: 12px 14px; overflow: auto; max-height: 60vh;')
}
writeFileSync(join(outDir, 'panel.css'), css, 'utf8')
console.log(`  wrote panel.css (${String(css.length)} chars)${useOriginal ? '  [original preview rule restored]' : ''}`)

// Enough rows that the content certainly exceeds the drawer's height.
const versionRows = Array.from({ length: 40 }, (_, index) => `
      <div class="sm-version-row">
        <span class="sm-version-tag sm-num">v1.0.${String(40 - index)}</span>
        <div class="sm-version-main">
          <div class="sm-version-log">Release note line ${String(index + 1)}: a change worth describing in enough
            words that it wraps across more than one line inside the drawer.</div>
          <div class="sm-version-date sm-num">2026-10-0${String((index % 9) + 1)}</div>
        </div>
      </div>`).join('')

const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="panel.css">
  <style>
    /* Stand in for the harness shell. The real one gives the panel a definite height; this reproduces that so the
       measurement is about the panel, not about a deliberately broken parent.

       "--shell pct" swaps the viewport unit for a percentage chain, which is what a host is more likely to use and
       which only resolves if every ancestor has a definite height. "--shell auto" removes the height entirely, the
       worst case: the panel is sized by its content and its own overflow:hidden then clips it.
       No backticks in this block: it lives inside a template literal. */
    html, body { margin: 0; height: 100%; }
    /* flex: 1 on the shell so the percentage height of #mount can resolve against the viewport-sized body. */
    #shell { ${shell === 'auto' ? 'flex: 1 1 auto;' : 'height: 100%;'} display: flex; flex-direction: column; min-height: 0; }
    #mount { ${shell === 'auto' ? 'height: auto; flex: 1 1 auto;' : shell === 'pct' ? 'height: 100%;' : 'height: 100vh;'} display: flex; flex-direction: column; min-height: 0; }
    #mount > [data-skill-market] { flex: 1 1 auto; min-height: 0; }
  </style>
</head>
<body>
  <div id="shell">
  <div id="mount">
    <div data-skill-market="" data-skill-market-panel="skill-market">
      <header class="sm-topbar"></header>
      <div class="sm-viewbar"></div>
      <div class="sm-fixed"></div>
      <main class="sm-content"><div class="sm-inner"></div></main>
      <div class="sm-statusbar"></div>
      <aside class="sm-inspector open" aria-label="drawer">
        <div class="sm-insp-head">
          <div class="sm-insp-top"><h2>编程专家.Skill</h2></div>
          <div class="sm-insp-pub">user_741dc82b · 开发编程</div>
          <div class="sm-insp-actions"></div>
          <div class="sm-insp-meta"><span class="sm-num">v2.0.3</span></div>
          <div class="sm-stat-strip"></div>
          <div class="sm-tabs" role="tablist">
            <button class="sm-tab active" role="tab">版本历史</button>
            <button class="sm-tab" role="tab">文件</button>
          </div>
        </div>
        <div class="sm-insp-body">
          <div class="sm-versions">${versionRows}
          </div>
        </div>
      </aside>
    </div>
  </div>
  </div>
  <script>
    // Measure what actually resolved, then write it into the DOM for --dump-dom to return.
    window.addEventListener('load', () => {
      const lines = []
      const report = (label, node) => {
        if (!node) { lines.push(label + ' :: MISSING'); return }
        const style = getComputedStyle(node)
        lines.push([
          label,
          'client=' + node.clientHeight,
          'scroll=' + node.scrollHeight,
          'overflow-y=' + style.overflowY,
          'height=' + style.height,
          'flex=' + style.flex,
          'minH=' + style.minHeight,
          'canScroll=' + (node.scrollHeight > node.clientHeight),
        ].join(' '))
      }
      report('mount            ', document.getElementById('mount'))
      report('panel            ', document.querySelector('[data-skill-market]'))
      report('main.sm-content  ', document.querySelector('.sm-content'))
      report('aside.sm-inspector', document.querySelector('.sm-inspector'))
      report('head             ', document.querySelector('.sm-insp-head'))
      report('body             ', document.querySelector('.sm-insp-body'))
      report('versions         ', document.querySelector('.sm-versions'))
      report('preview-code     ', document.querySelector('.sm-preview-code'))
      lines.push('viewport         :: ' + window.innerWidth + 'x' + window.innerHeight)
      const body = document.querySelector('.sm-insp-body')
      lines.push('VERDICT          :: ' + (body.scrollHeight > body.clientHeight
        ? 'body is scrollable (content taller than the box)'
        : 'body is NOT overflowing — its height grew to fit the content'))
      const out = document.createElement('pre')
      out.id = 'measure'
      out.textContent = lines.join('\\n')
      document.body.appendChild(out)
    })
  </script>
</body>
</html>
`
writeFileSync(join(outDir, 'index.html'), html, 'utf8')
console.log(`  wrote index.html`)
console.log(`  output: ${outDir}`)
