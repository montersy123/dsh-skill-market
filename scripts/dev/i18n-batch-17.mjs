/**
 * Batch 17 — the versions tab, and the permissions rows.
 *
 * `toLocaleDateString('zh-CN')` becomes a locale-aware call driven by the active language, so an English
 * reader does not get Chinese date ordering.
 */
export default [
  // Version/source table.
  ["          ['当前版本', skill.version || '未标注'],", "          [t('versions.currentVersion'), skill.version || t('misc.notStated')],"],
  ["          ['分类', skill.categoryName],", "          [t('versions.category'), skill.categoryName],"],
  ["          ['来源', skill.source === 'official' ? '官方' : '社区'],",
    "          [t('versions.source'), t(skill.source === 'official' ? 'misc.official' : 'misc.community')],"],
  ["          ['标识', skill.canonical],", "          [t('versions.identifier'), skill.canonical],"],
  ["          ['首次收录', new Date(skill.createdAt || Date.now()).toLocaleDateString('zh-CN')],",
    "          [t('versions.firstSeen'), new Date(skill.createdAt || Date.now()).toLocaleDateString(uiLocale())],"],
  ["          ['最近更新', new Date(skill.updatedAt || Date.now()).toLocaleDateString('zh-CN') + '（' + skill.updated + '）'],",
    "          [t('versions.updatedAt'), t('versions.updatedAtValue', {\n            date: new Date(skill.updatedAt || Date.now()).toLocaleDateString(uiLocale()),\n            relative: skill.updated,\n          })],"],

  // Update comparison block.
  ["              h('h4', null, '更新'),", "              h('h4', null, t('saved.update')),"],
  ["                    h('strong', null, behind ? '有新版本可用' : '已是 SkillHub 上的最新版本'),",
    "                    h('strong', null, t(behind ? 'versions.newAvailable' : 'versions.upToDate')),"],
  ["                      behind ? '可更新' : '最新')),", "                      t(behind ? 'saved.updatable' : 'versions.latest'))),"],
  ["                    '本地 v' + (local || '未标注') + ' · SkillHub v' + (latest || '未标注')\n                    + (behind && detail?.latestChangelog ? ' · ' + detail.latestChangelog : '')))))",
    "                    t('versions.comparison', {\n                      local: local || t('misc.notStated'),\n                      latest: latest || t('misc.notStated'),\n                    })\n                    + (behind && detail?.latestChangelog ? ' · ' + detail.latestChangelog : '')))))"],

  // History states.
  ["          h('h4', null, '版本历史'),", "          h('h4', null, t('versions.heading')),"],
  ["            ? h('p', { className: 'sm-body-note' }, '正在读取版本历史…')",
    "            ? h('p', { className: 'sm-body-note' }, t('versions.loading'))"],
  ["            ? h('p', { className: 'sm-body-note' }, '本地导入的技能没有 SkillHub 版本历史。')",
    "            ? h('p', { className: 'sm-body-note' }, t('versions.localHasNone'))"],
  ["              ? h('p', { className: 'sm-body-note' }, 'SkillHub 未返回版本记录。')",
    "              ? h('p', { className: 'sm-body-note' }, t('versions.none'))"],
  ["          h('h4', null, '版本与来源'),", "          h('h4', null, t('versions.versionAndSource')),"],

  // Permissions rows.
  ["            title: '网络访问',", "            title: t('perm.network'),"],
  ["            desc: '技能自身可能访问外部服务；' + (skill.requiresApiKey ? '作者标注需要自备 API Key。' : '作者未标注需要 API Key。'),",
    "            desc: t('perm.networkDesc', { key: t(skill.requiresApiKey ? 'perm.needsKey' : 'perm.noKeyNote') }),"],
  ["            title: '读取技能元数据',", "            title: t('perm.metadata'),"],
]
