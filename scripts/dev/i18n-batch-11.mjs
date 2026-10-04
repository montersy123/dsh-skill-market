/**
 * Batch 11 — the discover body: failure state, section counters, the lazy-load footer, and the
 * no-match empty state.
 *
 * `toLocaleString('zh-CN')` becomes `toLocaleString()` at the call site: the digits are formatted for
 * the reader before they reach the dictionary, so a dictionary entry never has to think about grouping
 * separators. That also fixes a real defect — a Chinese grouping was applied inside an English UI.
 */
export default [
  // Failure state.
  ["              title: '技能数据加载失败',", "              title: t('error.catalog'),"],
  ["            }, h(Icon, { name: 'i-refresh', size: 16 }), '重试'))", "            }, h(Icon, { name: 'i-refresh', size: 16 }), t('error.retry')))"],

  // Loading placeholder heading.
  ["                h('h2', null, category === 'all' ? '全部技能' : categoryLabel(category)),\n                h('span', { className: 'sm-meta sm-num' }, '加载中…')),",
    "                h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),\n                h('span', { className: 'sm-meta sm-num' }, t('status.loading'))),"],

  // Section heading and its counter, in both places it is rendered.
  ["                  h('h2', null, category === 'all' ? '全部技能' : categoryLabel(category)),",
    "                  h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),"],
  ["                    '共 ' + catalog.total.toLocaleString('zh-CN') + ' 个' +\n                    (searching || category !== 'all' ? '（本页 ' + visible.length + ' 个）' : ''))),",
    "                    t('discover.total', { total: catalog.total.toLocaleString() })\n                    + (searching || category !== 'all'\n                      ? t('discover.pageOf', { shown: visible.length.toLocaleString() })\n                      : ''))),"],

  // Lazy-load footer.
  ["                          loadingMore ? '加载中…' : '加载更多'),",
    "                          t(loadingMore ? 'status.loading' : 'card.loadMore')),"],
  ["                            '已显示 ' + visible.length.toLocaleString('zh-CN') + ' / ' + catalog.total.toLocaleString('zh-CN')))",
    "                            t('card.showing', {\n                              shown: visible.length.toLocaleString(),\n                              total: catalog.total.toLocaleString(),\n                            }))"],
  ["                          '已显示全部 ' + visible.length.toLocaleString('zh-CN') + ' 个')))",
    "                          t('card.showingAll', { total: visible.length.toLocaleString() })))"],

  // No-match empty state.
  ["                    title: '没有匹配的技能',", "                    title: t('empty.noMatch'),"],
  ["                    body: '换个关键词，或清空分类筛选后再试。',", "                    body: t('empty.noMatchBody'),"],
]
