/**
 * Batch 5 — relative time, file-tree summaries, and the HTTP error strings.
 *
 * Relative time is the clearest case for keys rather than concatenation: Chinese puts the unit after the
 * number with no space (`3 天前`) while English puts it after with one (`3 d ago`), and the two have
 * different spacing conventions, so glueing translated fragments would produce `3 d ago` only by luck.
 */
export default [
  // Relative time. Each unit is one key with a count.
  ["      if (ms <= 0) return '刚刚'", "      if (ms <= 0) return t('time.justNow')"],
  ["      if (ms < hour) return Math.max(1, Math.round(ms / minute)) + ' 分钟前'",
    "      if (ms < hour) return t('time.minutes', { count: Math.max(1, Math.round(ms / minute)) })"],
  ["      if (ms < day) return Math.round(ms / hour) + ' 小时前'",
    "      if (ms < day) return t('time.hours', { count: Math.round(ms / hour) })"],
  ["      if (ms < 30 * day) return Math.round(ms / day) + ' 天前'",
    "      if (ms < 30 * day) return t('time.days', { count: Math.round(ms / day) })"],
  ["      if (ms < 365 * day) return Math.round(ms / (30 * day)) + ' 个月前'",
    "      if (ms < 365 * day) return t('time.months', { count: Math.round(ms / (30 * day)) })"],
  ["      return Math.round(ms / (365 * day)) + ' 年前'",
    "      return t('time.years', { count: Math.round(ms / (365 * day)) })"],

  // File tree: a directory row's counts, and a collapsed node's tooltip.
  ["                String(node.files) + ' 个文件 · ' + humanSize(node.bytes))),",
    "                t('files.nodeSummary', { files: node.files, size: humanSize(node.bytes) }))),"],
  ["          title: node.path + ' · 点击查看内容',",
    "          title: t('files.nodeTitle', { path: node.path }),"],

  // The tree's own summary line, with and without a version.
  ["            String(tree.total) + ' 个文件 · ' + humanSize(tree.bytes)",
    "            t('files.treeSummaryBase', { files: tree.total, size: humanSize(tree.bytes) })"],
  ["            + ' · 点击文件查看内容'),", "            + t('files.treeHint')),"],

  // HTTP failures from the two request helpers, which appear three times each.
  ["        throw new Error(`技能市场接口返回了非 JSON 内容（HTTP ${response.status}）`)",
    "        throw new Error(t('err.notJson', { status: response.status }))", 3],
  ["      if (!response.ok) throw new Error(body?.error ?? `技能市场接口请求失败（HTTP ${response.status}）`)",
    "      if (!response.ok) throw new Error(body?.error ?? t('err.requestFailed', { status: response.status }))", 3],
]
