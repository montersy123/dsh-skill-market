/**
 * Batch 12 — version history rows, the shared switch tooltip, and the drawer fallbacks.
 */
export default [
  // Version row.
  ["              h('div', { className: 'sm-version-log' }, String(entry?.changelog ?? '') || '作者未填写更新说明'),",
    "              h('div', { className: 'sm-version-log' }, String(entry?.changelog ?? '') || t('versions.noChangelog')),"],
  ["              index === 0 ? h('span', { className: 'sm-badge plain' }, '最新') : null,",
    "              index === 0 ? h('span', { className: 'sm-badge plain' }, t('versions.latest')) : null,"],
  ["                ? h('span', { className: 'sm-badge plain' }, '已安装')",
    "                ? h('span', { className: 'sm-badge plain' }, t('card.installed'))", 2],
  ["          expanded ? '收起历史版本' : `展开其余 ${String(hidden)} 个版本`)",
    "          expanded ? t('versions.collapse') : t('versions.expand', { count: hidden }))"],

  // Switch tooltip.
  ["      return h('label', { className: 'sm-switch', title: '启用 / 停用' },",
    "      return h('label', { className: 'sm-switch', title: t('installed.toggleLabel') },"],

  // Drawer fallbacks for a row the catalogue does not know.
  ["          description: '已安装的技能；打开详情可读取 SkillHub 上的说明。',",
    "          description: t('overview.installedHint'),"],
  ["          publisher: handle || '本机',", "          publisher: handle || t('misc.localMachine'),"],
  ["          updated: '未知',", "          updated: t('misc.unknown'),"],
  ["          categoryName: '未分类',", "          categoryName: t('overview.unknownCategory'),"],
]
