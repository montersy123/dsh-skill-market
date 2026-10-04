/**
 * Batch 10 — local import: the per-file failure line, the missing-result error, and the outcomes.
 */
export default [
  ["              throw new Error(`Host 未返回导入结果（响应：${JSON.stringify(body)?.slice(0, 160) ?? 'null'}）`)",
    "              throw new Error(t('import.noResultDetail', { body: JSON.stringify(body)?.slice(0, 160) ?? 'null' }))"],
  ["            failures.push(`${String(file.name ?? '')}：${error instanceof Error ? error.message : String(error)}`)",
    "            // One key for the whole line: a filename joined to a reason by a full-width colon is a\n            // sentence, and English needs a different separator.\n            failures.push(t('import.fileFailed', { name: String(file.name ?? ''), reason: error instanceof Error ? error.message : String(error) }))"],
  ["          notify(names.length === 1 ? `已导入「${names[0]}」` : `已导入 ${String(names.length)} 个技能包`)",
    "          notify(names.length === 1\n            ? t('import.doneOne', { name: names[0] })\n            : t('import.doneMany', { count: names.length }))"],
  ["          notify(`导入失败：${failures[0]}`)", "          notify(t('import.failed', { reason: failures[0] }))"],
  ["          notify(`已导入 ${String(names.length)} 个，${String(failures.length)} 个失败：${failures[0]}`)",
    "          notify(t('import.doneMixed', { ok: names.length, failed: failures.length, reason: failures[0] }))"],
]
