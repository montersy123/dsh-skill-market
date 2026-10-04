/**
 * Batch 9 — the installed view: restart banner, empty state, and the row's own line.
 *
 * The row's sub-line is a chain of fragments (`v1.0.0`, publisher, downloads, install time) — each
 * fragment is one key, and the separators stay literal because `·` is the same glyph in both languages.
 */
export default [
  // Restart banner.
  ["                h('strong', null, '本次改了 ' + pendingRestart.size + ' 个技能'),",
    "                h('strong', null, t('restart.bannerTitle', { count: pendingRestart.size })),"],
  ["                h('p', null, '重启 DeepSeek Harness 后生效')),", "                h('p', null, t('restart.effect'))),"],
  ["                  title: '只是清掉这个提示，不影响技能状态',", "                  title: t('restart.dismissTitle'),"],
  ["                }, '知道了')))", "                }, t('restart.dismiss'))))"],

  // Installed empty state.
  ["              title: '还没有安装技能',", "              title: t('empty.noInstalled'),"],
  ["              body: '到技能市场挑选一个开始吧。',", "              body: t('empty.noInstalledBody'),"],
  ["            }, '去发现技能'))", "            }, t('empty.goDiscover')))", 2],

  // Row name badge and sub-line.
  ["                    isEnabled(entry) ? null : h('span', { className: 'sm-badge plain' }, '已停用')),",
    "                    isEnabled(entry) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),"],
  ["                    entry.origin === 'local' ? '本地导入' : (skill ? publisherOf(skill) : '本机记录'),",
    "                    entry.origin === 'local' || entry.origin === 'manual'\n                      ? t(entry.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')\n                      : (skill ? publisherOf(skill) : t('misc.machineRecord')),"],
  ["                        h('span', { className: 'sm-num' }, compact(skill.installs) + ' 下载')),",
    "                        h('span', { className: 'sm-num' }, t('card.downloadsValue', { value: compact(skill.installs) }))),"],
  ["                        h('span', { className: 'sm-num' }, '安装于 ' + relativeTime(entry.installedAt)))),",
    "                        h('span', { className: 'sm-num' }, t('installed.installedAt', { time: relativeTime(entry.installedAt) })))),"],
  ["                      'skill 目录：' + entry.directory,\n                      entry.files ? '（' + entry.files + ' 个文件）' : '')",
    "                      t('installed.dirPrefix') + entry.directory,\n                      entry.files ? t('installed.fileCount', { count: entry.files }) : '')"],

  // Row actions.
  ["                    ? h('span', { className: 'sm-badge update', title: '本次已修改，重启后对新会话生效' }, '待生效')",
    "                    ? h('span', { className: 'sm-badge update', title: t('installed.pendingBadgeTitle') }, t('installed.pendingBadge'))"],
  ["                    label: '启用 ' + name,", "                    label: t('installed.enableNamed', { name }),"],
  ["                    }, '详情')", "                    }, t('installed.details'))"],
]
