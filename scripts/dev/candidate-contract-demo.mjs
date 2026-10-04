/**
 * Demonstrate why a malformed provider candidate is a *catalog-wide* failure
 * rather than a skipped skill.
 *
 * The registry validates every candidate a provider returns, and that validation
 * throw propagates out of `ctx.skills.list()`. So one provider with one bad
 * candidate empties the entire catalog — including the harness's built-in
 * skills — which is exactly what happened when this plugin's provider omitted
 * `invocation`.
 *
 *   node --import ./scripts/asar-resolver.mjs tools/candidate-contract-demo.mjs
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ASAR_OUT = resolve('scripts/dev/asar-out')
const cordis = await import(pathToFileURL(resolve(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/cordis/lib/index.js')).href)
const registryModule = await import(pathToFileURL(resolve(ASAR_OUT, 'dsh/node_modules/@deepseek-ai/dsh-skill/lib/index.js')).href)

/**
 * Register one provider returning the given candidates and report what a plain
 * `list()` does.
 * @param {string} label - Scenario name.
 * @param {Array<object>} candidates - What the provider's `list()` returns.
 * @returns {Promise<{label: string, threw: string | null, count: number}>} Outcome.
 */
async function scenario (label, candidates) {
  const root = new cordis.Context()
  const registry = new registryModule.SkillRegistry(root)
  root.effect(() => registry.registerProvider(() => ({
    name: 'demo',
    list: () => candidates,
    get: () => undefined,
  })), 'demo provider')
  try {
    const listed = await registry.list()
    return { label, threw: null, count: listed.length }
  } catch (error) {
    return { label, threw: error instanceof Error ? error.message : String(error), count: 0 }
  }
}

const VALID = {
  name: 'valid-skill',
  description: 'A complete candidate.',
  invocation: { modelInvocable: true, userInvocable: true },
  source: 'custom',
  provider: 'demo',
  rank: 700,
}

/** The old bug exactly: the key was absent, not set to undefined. */
const { invocation: _dropped, ...candidateWithoutInvocation } = VALID

const results = []
results.push(await scenario('a complete candidate', [VALID]))
results.push(await scenario('candidate with no invocation key (the old bug)', [candidateWithoutInvocation]))
results.push(await scenario('candidate with a malformed invocation', [{
  ...VALID,
  invocation: { modelInvocable: 'yes' },
}]))
results.push(await scenario('one good + one malformed candidate', [VALID, { ...VALID, name: 'second', invocation: null }]))
results.push(await scenario('candidate missing rank', [{ ...VALID, rank: undefined }]))

console.log('scenario                                          list() outcome')
for (const result of results) {
  const verdict = result.threw === null ? `ok, ${result.count} skill(s)` : `THREW -> ${result.threw}`
  console.log(`${result.label.padEnd(48)}  ${verdict}`)
}

const withoutInvocation = results[1]
const malformed = results[2]
const mixed = results[3]
const noRank = results[4]
let failures = 0
const expect = (condition, label) => {
  if (condition) console.log(`  ok   ${label}`)
  else { failures += 1; console.error(`  FAIL ${label}`) }
}
console.log('')
expect(results[0].threw === null, 'a complete candidate lists cleanly')
expect(withoutInvocation.threw === null, 'omitting the invocation key is tolerated')
expect(malformed.threw !== null, 'a malformed invocation aborts the whole list() call')
expect(mixed.threw !== null, 'one bad candidate poisons every good one in the same call')
expect(/invocation/.test(malformed.threw ?? ''), 'the abort names the invocation field')
expect(noRank.threw !== null && /rank/.test(noRank.threw ?? ''), 'a missing rank aborts too, and the abort names it')

console.log(failures === 0 ? '\nCONTRACT DEMO OK' : `\n${failures} ASSERTION(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
