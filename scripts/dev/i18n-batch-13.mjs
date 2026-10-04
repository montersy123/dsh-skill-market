/**
 * Batch 13 — the update button, the uninstall control, and the saved view.
 */
export default [
  // Update button, in both rows that carry it.
  ["                      title: 'v' + updateStateFor(skill).local + ' → v' + updateStateFor(skill).latest,",
    "                      title: t('saved.versionArrow', { local: updateStateFor(skill).local, latest: updateStateFor(skill).latest }),", 1],
  ["                    }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), '更新')",
    "                    }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))", 1],
  ["                  }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), '更新')",
    "                  }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))", 1],

  // Uninstall control on an installed row.
  ["                    'aria-label': '卸载 ' + name,\n                    title: '卸载',",
    "                    'aria-label': t('action.uninstallNamed', { name }),\n                    title: t('action.uninstall'),"],

  // Saved view head and empty state.
  ["            h('p', { className: 'sm-page-sub' }, saved.length + ' 个技能已收藏，仅保存在本机。')))",
    "            h('p', { className: 'sm-page-sub' }, t('saved.subtitle', { count: saved.length }))))"],
  ["              title: '收藏夹是空的',", "              title: t('empty.noSaved'),"],
  ["              body: '在技能卡片上点击书签图标即可收藏。',", "              body: t('empty.noSavedBody'),"],

  // Saved row sub-line.
  ["                  h('span', { className: 'sm-num' }, compact(skill.installs) + ' 下载'),\n                  h('span', { className: 'sm-sep' }, '·'),\n                  h('span', { className: 'sm-num' }, skill.rating + ' 分'))),",
    "                  h('span', { className: 'sm-num' }, t('card.downloadsValue', { value: compact(skill.installs) })),\n                  h('span', { className: 'sm-sep' }, '·'),\n                  h('span', { className: 'sm-num' }, t('card.ratingValue', { value: skill.rating })))),"],

  // Saved row actions.
  ["                  }, '详情'),", "                  }, t('installed.details')),"],
  ["                  }, h(Icon, { name: 'i-download', size: 15 }), '安装'),",
    "                  }, h(Icon, { name: 'i-download', size: 15 }), t('card.install')),"],
  ["                  'aria-label': '取消收藏 ' + skill.name,\n                  title: '取消收藏',",
    "                  'aria-label': t('card.unsave', { name: skill.name }),\n                  title: t('card.unsaveShort'),"],
]
