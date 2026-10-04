/**
 * Prepend a `# vX.Y.Z` heading to a release body that lacks one.
 *
 * Several releases were published with the version only in the title field, so their pages begin mid-sentence while
 * a later release begins with the heading. This fetches the current body through the API, adds the heading, and
 * writes it back without touching anything else — the body is a published document, so the change is deliberately
 * limited to one inserted line.
 *
 *   node scripts/dev/add-release-heading.mjs <owner/repo> <tag> <--apply>
 */
const [repo, tag, ...flags] = process.argv.slice(2)
const apply = flags.includes('--apply')
if (repo === undefined || tag === undefined) {
  console.error('  usage: node scripts/dev/add-release-heading.mjs <owner/repo> <tag> [--apply]')
  process.exit(1)
}

// `gh api` with an explicit Accept header so the response is the JSON document, not the rendered page.
const { execFileSync } = await import('node:child_process')
const gh = process.env.GH_PATH ?? 'gh'

/** Run gh and return stdout. */
function ghApi(args) {
  return execFileSync(gh, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

const raw = ghApi(['api', `repos/${repo}/releases/tags/${tag}`])
const release = JSON.parse(raw)
const body = release.body ?? ''
const heading = `# ${tag}`

console.log(`  repo        : ${repo}`)
console.log(`  tag         : ${tag}`)
console.log(`  title       : ${release.name}`)
console.log(`  body bytes  : ${String(Buffer.byteLength(body, 'utf8'))}`)
console.log(`  first line  : ${JSON.stringify(body.split('\n')[0])}`)
console.log('')

if (body.startsWith(heading)) {
  console.log('  already starts with the heading; nothing to do')
  process.exit(0)
}

const updated = `${heading}\n\n${body.replace(/^\s+/, '')}`
console.log(`  new first line: ${JSON.stringify(updated.split('\n')[0])}`)
console.log(`  new byte count: ${String(Buffer.byteLength(updated, 'utf8'))}`)

if (apply === false) {
  console.log('')
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}

// Write the body to a file outside the repository so no shell quoting or console encoding touches it.
const { writeFileSync, readFileSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const scratch = join(tmpdir(), `release-body-${tag.replace(/[^\w.-]/g, '_')}.md`)
writeFileSync(scratch, updated, 'utf8')

// Confirm the bytes on disk before publishing them.
const written = readFileSync(scratch)
if (written.toString('utf8').includes('\uFFFD')) {
  console.error('  FAIL: replacement characters in the file; refusing to publish')
  process.exit(1)
}
console.log(`  wrote ${String(written.length)} bytes to ${scratch}`)

ghApi(['release', 'edit', tag, '--repo', repo, '--notes-file', scratch])
console.log('  release body updated')
