/**
 * Probe which SkillHub URL a person can actually open for one skill.
 *
 * Kept because the answer is not guessable and upstream's own `homepage` field is wrong. Measured
 * for `<ns>/<slug>` = `indiv-ebandao/dev-expert`:
 *
 *   api.skillhub.cn/<ns>/<slug>        405, no body      ← what `homepage` says
 *   skillhub.cn/<ns>/<slug>            200, 7 KB shell   ← SPA fallback, no skill data
 *   skillhub.cn/skills/<ns>/<slug>     200, 48 KB, og:title names the skill  ← the real one
 *
 * The public site is a single-page app, so **every** route answers 200 with a shell. A status code
 * therefore proves nothing, and neither does the presence of an `og:title` alone — so this compares
 * against a route known to be wrong. A response that is merely the generic shell (the same shell the
 * wrong route returns, and no skill-specific metadata) is not the skill's page.
 *
 *   node scripts/public-url-probe.mjs [namespace] [slug]
 */
const namespace = process.argv[2] ?? 'indiv-ebandao'
const slug = process.argv[3] ?? 'dev-expert'

const CANDIDATES = [
  `https://api.skillhub.cn/${namespace}/${slug}`,
  `https://skillhub.cn/${namespace}/${slug}`,
  `https://skillhub.cn/skills/${namespace}/${slug}`,
  `https://skillhub.cn/skill/${namespace}/${slug}`,
]

/** Fetch a URL and report the parts that distinguish a skill page from the app shell. */
async function inspect(url) {
  const response = await fetch(url, { redirect: 'follow' })
  const type = (response.headers.get('content-type') ?? '').split(';')[0]
  const html = type === 'text/html' ? await response.text() : ''
  const title = /<title[^>]*>([^<]*?)\s*<\/title>/i.exec(html)
  const ogTitle = /property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html)
  return {
    url,
    status: response.status,
    type,
    bytes: html.length,
    title: title === null ? '' : title[1],
    ogTitle: ogTitle === null ? '' : ogTitle[1],
  }
}

// A route that is definitely not the skill's page: it returns the empty application shell. Whatever
// that shell looks like is the baseline every candidate has to differ from.
const baseline = await inspect(`https://skillhub.cn/skill/${namespace}/${slug}`)
console.log('baseline (a wrong route, so this IS the app shell):')
console.log('  bytes:', baseline.bytes, '| title:', baseline.title, '| og:title:', JSON.stringify(baseline.ogTitle))
console.log('')

let verdict = null
for (const url of CANDIDATES) {
  const found = await inspect(url)
  const isShell = found.bytes <= baseline.bytes + 512 && found.ogTitle === ''
  const distinct = found.ogTitle !== '' && found.bytes > baseline.bytes
  console.log(found.url)
  console.log('  status:', found.status, '| type:', found.type || '(none)', '| bytes:', found.bytes)
  console.log('  <title>  :', found.title || '(none)')
  console.log('  og:title :', found.ogTitle || '(none)')
  console.log('  verdict  :', distinct ? 'SKILL PAGE' : (isShell ? 'app shell (not a skill page)' : 'unclear'))
  if (distinct && verdict === null) verdict = found.url
  console.log('')
}

console.log(verdict === null
  ? "NO OPENABLE ROUTE FOUND — the panel's public URL would need revisiting"
  : `OPENABLE: ${verdict}`)
process.exit(verdict === null ? 1 : 0)
