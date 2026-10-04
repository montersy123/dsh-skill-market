/**
 * Batch 2 — the discover view: page head, sort control, search, and category chips.
 *
 * The sort option labels become keys rather than text, so they follow the active language instead of
 * being frozen at module load.
 */
export default [
  // Sort option labels, resolved when the select renders.
  ["    { value: 'downloads', label: '按下载量' },", "    { value: 'downloads', label: 'sort.downloads' },"],
  ["    { value: 'score', label: '按综合评分' },", "    { value: 'score', label: 'sort.score' },"],
  ["    { value: 'stars', label: '按收藏数' },", "    { value: 'stars', label: 'sort.stars' },"],
  ["    { value: 'updated_at', label: '按更新时间' },", "    { value: 'updated_at', label: 'sort.updated' },"],

  // The select renders each label through the translator.
  ["}, SORTS.map((option) => h('option', { key: option.value, value: option.value }, option.label)))))",
    "}, SORTS.map((option) => h('option', { key: option.value, value: option.value }, t(option.label))))))"],

  // Page head.
  ["                '来自 SkillHub 的技能库，默认按下载量排序。安装后即可在任意会话中直接调用。')),",
    "                t('discover.subtitle'))),"],
  ["                  'aria-label': '排序方式',", "                  'aria-label': t('sort.aria'),"],

  // Search.
  ["              placeholder: '搜索技能、描述或关键词',", "              placeholder: t('search.placeholder'),"],
  ["              'aria-label': '搜索技能、描述或关键词',", "              'aria-label': t('search.placeholder'),"],

  // Category chips: the "all" chip is built from a label plus a count.
  ["              title: '全部技能',", "              title: t('discover.all'),"],
  ["            }, '全部 ', h('span', { className: 'sm-chip-n' }, catalog.total.toLocaleString('zh-CN'))),",
    "            }, t('discover.all') + ' ', h('span', { className: 'sm-chip-n' }, catalog.total.toLocaleString('zh-CN'))),"],
]
