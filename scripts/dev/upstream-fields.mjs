/**
 * Report the full field set upstream returns, so a feature is not designed around a guess.
 *
 *   node scripts/upstream-fields.mjs [keyword]
 */
const listUrl = 'https://api.skillhub.cn/api/skills?page=1&pageSize=3&sortBy=score&order=desc'
const list = await (await fetch(listUrl)).json()
const first = list.data.skills[0]

console.log('=== list: /api/skills ===')
console.log('  top-level keys:', Object.keys(list).join(', '))
console.log('  data keys     :', Object.keys(list.data).join(', '))
console.log('  skill keys    :', Object.keys(first).join(', '))
console.log('')
console.log(JSON.stringify(first, null, 2).split('\n').slice(0, 80).join('\n'))

const detailUrl = `https://api.skillhub.cn/api/v1/skills/${first.slug}?namespace=${first.namespace.handle}`
const detail = await (await fetch(detailUrl)).json()
console.log('')
console.log('=== detail: /api/v1/skills/<slug> ===')
console.log('  top-level keys:', Object.keys(detail).join(', '))
const skill = detail.data?.skill ?? detail.skill ?? detail.data
console.log('  skill keys    :', skill === undefined ? '(none)' : Object.keys(skill).join(', '))
console.log('')
console.log(JSON.stringify(detail, null, 2).split('\n').slice(0, 100).join('\n'))

// Anything that could carry a safety/security statement, named by any plausible spelling.
const SECURITY_WORDS = /secur|safe|safe_|risk|audit|verified|verify|cert|trust|scan|review|inspect|malware|virus|privacy|permission/i
const found = []
for (const [source, object] of [['list', first], ['detail', skill ?? {}]]) {
  for (const [key, value] of Object.entries(object)) {
    if (SECURITY_WORDS.test(key)) found.push(`${source}.${key} = ${JSON.stringify(value)}`)
    if (value !== null && typeof value === 'object' && Array.isArray(value) === false) {
      for (const [innerKey, innerValue] of Object.entries(value)) {
        if (SECURITY_WORDS.test(innerKey)) found.push(`${source}.${key}.${innerKey} = ${JSON.stringify(innerValue)}`)
      }
    }
  }
}
console.log('')
console.log('=== fields whose name suggests safety/security ===')
console.log(found.length === 0 ? '  (none)' : found.map((line) => '  ' + line).join('\n'))
