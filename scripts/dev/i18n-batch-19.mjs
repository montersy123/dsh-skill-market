/**
 * Batch 19 — the final strings: drawer tabs and header, status bar, toasts, safety badge, and the
 * stat strip.
 *
 * Tab labels become keys resolved at render, for the same reason the sort options did: the tab strip is
 * built once per render, so a label frozen at module load would not follow a language switch.
 */
export default [
  // The drawer's own source fallback.
  ["setPreviews((current) => ({ ...current, [key]: { kind: 'failed', reason: '该技能没有 SkillHub 来源' } }))",
    "setPreviews((current) => ({ ...current, [key]: { kind: 'failed', reason: t('files.noSource') } }))"],

  // Pruned-favourites notice.
  ["        notify('已清理 ' + orphans.length + ' 个无法解析的旧收藏')",
    "        notify(t('error.prunedFavorites', { count: orphans.length }))"],

  // Installed view subtitle.
  ["            installed.length + ' 个技能已加入本地技能库，可随时停用而不卸载。')))",
    "            t('installed.subtitle', { count: installed.length })))"],

  // Drawer tab labels.
  ["          ['overview', '概览'],\n          ['files', '文件'],\n          ['versions', '版本历史'],\n          ['permissions', '权限'],\n          ['safety', '安全扫描'],\n          ['metrics', '指标'],",
    "          ['overview', 'tab.overview'],\n          ['files', 'tab.files'],\n          ['versions', 'tab.versions'],\n          ['permissions', 'tab.permissions'],\n          ['safety', 'tab.safety'],\n          ['metrics', 'tab.metrics'],"],
  ["              }, key === 'safety' ? h(Icon, { name: 'i-shield-check', size: 13 }) : null, label))),",
    "              }, key === 'safety' ? h(Icon, { name: 'i-shield-check', size: 13 }) : null, t(label)))),"],

  // Drawer header.
  ["            'aria-label': '技能详情',", "            'aria-label': t('drawer.aria'),"],
  ["                  'aria-label': '关闭详情',", "                  'aria-label': t('drawer.close'),"],
  ["                  }, h(Icon, { name: 'i-check', size: 16 }), '已安装 · 卸载')",
    "                  }, h(Icon, { name: 'i-check', size: 16 }), t('drawer.uninstallInstalled'))"],
  ["                  }, h(Icon, { name: 'i-download', size: 16 }), '安装技能'),",
    "                  }, h(Icon, { name: 'i-download', size: 16 }), t('drawer.installSkill')),"],
  ["                }, h(Icon, { name: 'i-bookmark', size: 16 }), savedIds.has(skill.id) ? '已收藏' : '收藏')),",
    "                }, h(Icon, { name: 'i-bookmark', size: 16 }), t(savedIds.has(skill.id) ? 'drawer.savedState' : 'card.saveShort'))),"],
  ["                h('span', { className: 'sm-num' }, skill.version ? 'v' + skill.version : '版本未标注'),",
    "                h('span', { className: 'sm-num' }, skill.version ? 'v' + skill.version : t('drawer.versionUnknown')),"],
  ["                h('span', null, skill.source === 'official' ? '官方来源' : '社区来源'),",
    "                h('span', null, t(skill.source === 'official' ? 'drawer.sourceOfficial' : 'drawer.sourceCommunity')),"],
  ["                h('span', null, '更新于 ' + skill.updated))),",
    "                h('span', null, t('drawer.updatedAt', { time: skill.updated }))),"],

  // Status bar and topbar.
  ["      const liveText = status === 'loading' ? '正在同步 SkillHub'\n        : status === 'error' ? 'SkillHub 连接异常'\n          : '已连接 SkillHub'",
    "      const liveText = t(status === 'loading' ? 'status.syncing'\n        : status === 'error' ? 'status.error'\n          : 'status.connected')"],
  ["              'aria-label': '刷新技能数据',\n              title: '刷新',",
    "              'aria-label': t('search.refresh'),\n              title: t('search.refreshShort'),"],
  ["            }, h(Icon, { name: 'i-upload', size: 16 }), h('span', { className: 'sm-btn-label' }, '导入技能')))),",
    "            }, h(Icon, { name: 'i-upload', size: 16 }), h('span', { className: 'sm-btn-label' }, t('import.pickFile')))),"],
  ["            }, '本地导入 ', h('span', { className: 'sm-vt-count' }, imported.length)))),",
    "            }, t('view.import') + ' ', h('span', { className: 'sm-vt-count' }, imported.length)))),"],
  ["          h('span', { className: 'sm-num' }, 'SkillHub 共 ' + catalog.total.toLocaleString('zh-CN') + ' 个技能'),",
    "          h('span', { className: 'sm-num' }, t('metrics.total', { total: catalog.total.toLocaleString() })),"],
  ["            }, '撤销'))),", "            }, t('toast.undo')))),"],

  // Safety badge and vendor names.
  ["        title: '安全扫描通过：所有检测方均报告安全，无风险',", "        title: t('safety.badgeTitle'),"],
  ["        compact ? null : '安全')", "        compact ? null : t('safety.badge'))"],
  ["    const VENDOR_NAMES = { keen: '科恩实验室', sanbu: '云鼎实验室' }",
    "    const VENDOR_NAMES = { keen: 'misc.vendorKeen', sanbu: 'misc.vendorSanbu' }"],

  // Stat strip.
  ["          h('span', null, '下载量')),", "          h('span', null, t('metrics.downloads'))),"],
  ["          h('span', null, '收藏')),", "          h('span', null, t('card.saved'))),"],
  ["          h('span', null, '综合评分')),", "          h('span', null, t('metrics.score'))),"],
  ["          h('span', null, '版本')))", "          h('span', null, t('card.version'))))"],

  // Unknown byte count.
  ["      if (!Number.isFinite(n) || n <= 0) return '未知大小'", "      if (!Number.isFinite(n) || n <= 0) return t('files.unknownSize')"],
]
