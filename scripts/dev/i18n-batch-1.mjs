/**
 * Batch 1 — the shell: view tabs, sidebar entry, and the top-level page headings.
 *
 * Each entry is `[exact source span, replacement, expected occurrences]`. The expected count is
 * checked, so a span that stops matching fails the batch rather than silently doing nothing.
 */
export default [
  // View tabs and the sidebar entry.
  ["'aria-label': '技能市场视图' },", "'aria-label': t('panel.aria') },"],
  ["}, '发现'),", "}, t('view.discover')),"],
  ["}, '已安装 ', h('span', { className: 'sm-vt-count' }, installed.length)),",
    "}, t('view.installed') + ' ', h('span', { className: 'sm-vt-count' }, installed.length)),"],
  ["}, '收藏 ', h('span', { className: 'sm-vt-count' }, saved.length)),",
    "}, t('view.saved') + ' ', h('span', { className: 'sm-vt-count' }, saved.length)),"],
  ["label: () => '技能市场',", "label: () => t('panel.title'),"],

  // Page headings.
  ["h('h1', { className: 'sm-page-title' }, '已安装'),", "h('h1', { className: 'sm-page-title' }, t('view.installed')),"],
  ["h('h1', { className: 'sm-page-title' }, '收藏'),", "h('h1', { className: 'sm-page-title' }, t('view.saved')),"],
  ["h('h1', { className: 'sm-page-title' }, '本地导入'),", "h('h1', { className: 'sm-page-title' }, t('view.import')),"],

  // Eyebrows above those headings.
  ["h('p', { className: 'sm-eyebrow' }, 'LIBRARY'),", "h('p', { className: 'sm-eyebrow' }, t('installed.eyebrow')),"],
  ["h('p', { className: 'sm-eyebrow' }, 'COLLECTION'),", "h('p', { className: 'sm-eyebrow' }, t('saved.eyebrow')),"],
  ["h('p', { className: 'sm-eyebrow' }, 'LOCAL'),", "h('p', { className: 'sm-eyebrow' }, t('import.eyebrow')),"],
  ["h('p', { className: 'sm-eyebrow' }, 'DISCOVER'),", "h('p', { className: 'sm-eyebrow' }, t('discover.eyebrow')),"],
  ["h('h1', { className: 'sm-page-title' }, '发现技能'),", "h('h1', { className: 'sm-page-title' }, t('discover.title')),"],
]
