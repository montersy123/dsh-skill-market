/**
 * Batch 15 — the local-import row, and the overview tab's bullets and headings.
 *
 * The overview bullets are whole sentences with a value inside, so each becomes one key rather than
 * three translated fragments: `来自 X，标识 Y` puts the value in the middle in Chinese and at the end in
 * English, and a sentence's shape is not a property of its pieces.
 */
export default [
  // Local-import row.
  ["                    row.origin === 'manual' ? '手动放置' : '本地导入'),",
    "                    t(row.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')),"],
  ["                  isEnabled(row) ? null : h('span', { className: 'sm-badge plain' }, '已停用')),",
    "                  isEnabled(row) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),"],
  ["                  row.version ? h('span', { className: 'sm-num' }, 'v' + row.version) : h('span', null, '未标注版本'),",
    "                  row.version ? h('span', { className: 'sm-num' }, 'v' + row.version) : h('span', null, t('installed.noVersion')),"],
  ["                  h('span', { className: 'sm-num', title: row.directory }, String(row.files ?? 0) + ' 个文件'),",
    "                  h('span', { className: 'sm-num', title: row.directory }, t('installed.fileCountBare', { count: row.files ?? 0 })),"],
  ["                  label: '启用 ' + row.name,", "                  label: t('installed.enableNamed', { name: row.name }),"],
  ["                  'aria-label': '移除 ' + row.name,\n                  title: '移除',",
    "                  'aria-label': t('installed.removeNamed', { name: row.name }),\n                  title: t('installed.remove'),"],

  // Overview bullets.
  ["          '来自 ' + (skill.official ? 'SkillHub 认证' : 'SkillHub 社区') + '，标识 ' + skill.canonical,",
    "          t(skill.official ? 'overview.fromOfficial' : 'overview.fromCommunity', { canonical: skill.canonical }),"],
  ["          '分类：' + skill.categoryName,", "          t('card.categoryLabel', { name: skill.categoryName }),"],
  ["          skill.version ? '当前版本 v' + skill.version : '版本信息由作者维护',",
    "          skill.version ? t('overview.version', { version: skill.version }) : t('overview.versionMaintained'),"],
  ["          skill.requiresApiKey ? '需要自备 API Key' : '无需额外 API Key',",
    "          skill.requiresApiKey ? t('overview.needsKey') : t('overview.noKey'),"],

  // Overview body.
  ["            ? h('p', { className: 'sm-body-note' }, '简介加载失败：' + detail.reason)",
    "            ? h('p', { className: 'sm-body-note' }, t('overview.summaryFailed', { reason: detail.reason }))"],
  ["            ? h(React.Fragment, null, h('h4', null, '简介'), h('p', null, summary))",
    "            ? h(React.Fragment, null, h('h4', null, t('overview.summary')), h('p', null, summary))"],
  ["              h('h4', null, '简介'),\n              h('p', null, skill.description || '该技能未提供简介。'))",
    "              h('h4', null, t('overview.summary')),\n              h('p', null, skill.description || t('card.noDescription')))"],
  ["          h('h4', null, '关键信息'),", "          h('h4', null, t('overview.keyInfo')),"],
  ["          h('h4', null, '适用场景'),", "          h('h4', null, t('overview.useCases')),"],
]
