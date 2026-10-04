/**
 * Print the version declared by the SKILL.md of one installed skill.
 *
 * The panel reads this too, and it is only ever a fallback: upstream ships packages whose
 * `version:` field names a different release than the files they contain (measured on both
 * `dev-expert` 2.0.2 -> "2.0.3" and `parenting-expert` 1.11.4 -> "1.13.0"), so a matching
 * version string is luck, not a guarantee.
 *
 *   node tools/installed-frontmatter.mjs <handle> <slug>
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const handle = process.argv[2] ?? 'indiv-ebandao'
const slug = process.argv[3] ?? 'dev-expert'
const directory = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills', `${handle}--${slug}`)
const instruction = join(directory, 'SKILL.md')

if (existsSync(instruction) === false) {
  console.error('no SKILL.md at', instruction)
  process.exit(1)
}

const text = readFileSync(instruction, 'utf8')
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
const match = frontmatter === null ? null : /^version:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter[1])

console.log('file    :', instruction)
console.log('bytes   :', text.length)
console.log('version :', match === null ? '(no version field)' : match[1].replace(/^["']|["']$/g, ''))
