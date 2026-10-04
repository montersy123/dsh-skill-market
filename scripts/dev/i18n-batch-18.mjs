/**
 * Batch 18 — the safety tab, the metrics tab, and the permissions prose.
 */
export default [
  // Permissions rows and prose.
  ["            title: '本地技能库',", "            title: t('perm.localLibrary'),"],
  ["            desc: '本插件仅从 SkillHub 读取公开的名称、简介、版本与统计信息，不写入你的任何数据。',",
    "            desc: t('perm.metadataDesc'),"],
  ["            desc: '「安装」只在本机记录该技能并启用；技能文件本身仍由你通过本地导入提供。',",
    "            desc: t('perm.localLibraryDesc'),"],
  ["          h('h4', null, '需要的权限'),", "          h('h4', null, t('perm.heading')),"],
  ["          h('p', { className: 'sm-body-note' }, '以下说明区分技能自身的声明与本插件的行为，你可以在设置中随时收回。'),",
    "          h('p', { className: 'sm-body-note' }, t('perm.note')),"],

  // Safety tab: states.
  ["            h('p', { className: 'sm-body-note' }, '正在读取检测结果…'))",
    "            h('p', { className: 'sm-body-note' }, t('safety.loading')))"],
  ["            h('p', { className: 'sm-body-note' }, '检测结果读取失败：' + String(entry.reason ?? '')))",
    "            h('p', { className: 'sm-body-note' }, t('safety.failed', { reason: String(entry.reason ?? '') })))"],
  ["            h('p', { className: 'sm-body-note' }, 'SkillHub 未提供该技能的安全检测结果。'))",
    "            h('p', { className: 'sm-body-note' }, t('safety.none')))"],
  ["        const verdictText = safe\n          ? '所有检测方均报告安全，无风险'\n          : (entry.verdict === 'risk'\n            ? '有检测方报告可疑，存在潜在风险'\n            : (entry.verdict === 'pending' ? '检测仍在排队中' : '检测结果未明'))",
    "        const verdictText = t(safe\n          ? 'safety.allBenign'\n          : (entry.verdict === 'risk'\n            ? 'safety.hasRisk'\n            : (entry.verdict === 'pending' ? 'safety.pending' : 'safety.unknown')))"],
  ["          h('p', { className: 'sm-body-note' }, '结果由 SkillHub 的第三方检测方给出，与「权限」页说明的本插件行为无关。'),",
    "          h('p', { className: 'sm-body-note' }, t('safety.note')),"],
  ["                }, '查看报告', h(Icon, { name: 'i-link', size: 12 }))",
    "                }, t('safety.report'), h(Icon, { name: 'i-link', size: 12 }))"],
  ["            safe\n              ? '卡片与详情页的「安全」标记只在全部检测方都报告安全时出现。'\n              : '「安全」标记只在全部检测方都报告安全时出现，因此当前不显示该标记。'))",
    "            t(safe ? 'safety.shownNote' : 'safety.hiddenNote')))"],

  // Metrics tab.
  ["          h('h4', null, 'SkillHub 指标'),", "          h('h4', null, t('metrics.heading')),"],
  ["          h('p', { className: 'sm-body-note' }, '全部数值直接来自 SkillHub 公开接口。'),",
    "          h('p', { className: 'sm-body-note' }, t('metrics.note')),"],
  ["              h('div', { className: 'sm-k' }, '下载量'),", "              h('div', { className: 'sm-k' }, t('metrics.downloads')),"],
  ["              h('div', { className: 'sm-k' }, '收藏数'),", "              h('div', { className: 'sm-k' }, t('metrics.stars')),"],
  ["              h('div', { className: 'sm-k' }, '综合评分'),", "              h('div', { className: 'sm-k' }, t('metrics.score')),"],
  ["              h('div', { className: 'sm-k' }, '评分折算'),", "              h('div', { className: 'sm-k' }, t('metrics.rating')),"],
  ["              h('h4', null, '主页'),", "              h('h4', null, t('metrics.homepage')),"],
]
