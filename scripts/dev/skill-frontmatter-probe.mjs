/**
 * Find one upstream skill by keyword and inspect the `SKILL.md` its bundle actually contains.
 *
 * The card showed a skill whose frontmatter `name` is not kebab-case, and DSH's loader rejects such a
 * file outright: `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`. The question this answers is whether the
 * bad name comes from the publisher's own `SKILL.md` or from something this plugin writes, which
 * decides whether it is ours to fix.
 *
 *   node scripts/skill-frontmatter-probe.mjs "playwright"
 */
const keyword = process.argv[2] ?? 'playwright'

const list = await (await fetch(
  `https://api.skillhub.cn/api/skills?page=1&pageSize=20&sortBy=score&order=desc&keyword=${encodeURIComponent(keyword)}`,
)).json()
const rows = list.data?.skills ?? []
console.log(`  keyword "${keyword}" matched ${rows.length} skill(s) on page 1\n`)
if (rows.length === 0) process.exit(0)

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

for (const entry of rows.slice(0, 6)) {
  console.log(`${entry.name}`)
  console.log(`  slug=${entry.slug}  namespace=${entry.namespace.handle}  version=${entry.version}`)
  // The bundle's own SKILL.md, which is what the harness loads.
  const fileUrl = `https://api.skillhub.cn/api/v1/skills/${entry.slug}/file?path=SKILL.md&namespace=${entry.namespace.handle}`
  let text = ''
  try {
    const response = await fetch(fileUrl)
    text = await response.text()
  } catch (error) {
    console.log(`  SKILL.md fetch failed: ${error.message}\n`)
    continue
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) {
    console.log(`  no frontmatter block found (${String(text.length)} bytes)\n`)
    continue
  }
  const nameLine = /^name:\s*(.*)$/m.exec(match[1])
  const declared = nameLine === null ? '' : nameLine[1].trim().replace(/^["']|["']$/g, '')
  console.log(`  frontmatter name: ${JSON.stringify(declared)}`)
  console.log(`  is kebab-case   : ${SKILL_NAME.test(declared)}`)
  if (SKILL_NAME.test(declared) === false) {
    console.log('  -> DSH would ignore this file and warn "invalid skill name"')
  }
  console.log('')
}
