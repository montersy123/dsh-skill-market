/**
 * A stand-in for the Host's panel-state route, for the harnesses that render the panel.
 *
 * The panel's durable state lives in a file the Host owns (`<profile>/@…/data/panel.json`),
 * reached through `GET`/`POST /skill-market/api/state`. The render harnesses stub `fetch` and
 * have no Host, so this answers that one route from memory and keeps the document the way the
 * Host would: the last write wins, and a GET reports it back with the revision the next write
 * will replace.
 *
 * Three harnesses need the same behaviour, and a second copy of "what the Host would answer"
 * would drift from the first — which is exactly how a check starts passing for the wrong reason.
 *
 * @param {object} [options] - Initial contents.
 * @param {object | null} [options.state] - The stored document, or null when the file is absent.
 * @param {number} [options.harnessStartedAt] - The Host process start time the route reports.
 * @param {number} [options.revision] - Starting revision; a write bumps it.
 * @returns {{store: object, answer: (target: string, method: string, body: unknown) => object | null}}
 *   The store (state, revision, `writes`) and a request handler.
 */
export function createPanelStateStub(options = {}) {
  const store = {
    state: options.state ?? null,
    harnessStartedAt: options.harnessStartedAt ?? 1_700_000_000_000,
    revision: options.revision ?? 1,
    /** Every document the panel wrote, in order, so a check can inspect what it sent. */
    writes: [],
    /**
     * When true, a write is refused — a Host half without the `state` route, or one that failed.
     * The panel has to keep the data somewhere in that case, so it is a case worth driving.
     */
    failWrites: options.failWrites === true,
  }
  return {
    store,
    /**
     * Answer one request when it addresses the state route.
     * @param {string} target - Request URL.
     * @param {string} method - HTTP method.
     * @param {unknown} body - Parsed request body, for a POST.
     * @returns {object | null} A `fetch`-shaped response, or null when this is another route.
     */
    answer(target, method, body) {
      if (String(target).includes('/state') === false) return null
      if (method === 'POST') {
        if (store.failWrites === true) {
          return { ok: false, status: 404, async json() { return { error: '未知的技能市场接口：/state' } } }
        }
        store.state = body
        store.writes.push(body)
        store.revision += 1
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, revision: store.revision, harnessStartedAt: store.harnessStartedAt }
          },
        }
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            state: store.state,
            revision: store.revision,
            harnessStartedAt: store.harnessStartedAt,
          }
        },
      }
    },
  }
}
