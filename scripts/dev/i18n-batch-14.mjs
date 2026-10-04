/**
 * Batch 14 — the local import view: head, dropzone, counters, and the empty state.
 */
export default [
  // Head.
  ["            h('p', { className: 'sm-page-sub' },\n              '导入当前设备上的技能包，仅在本地生效，不会同步到市场或团队工作区。导入后即可在任意会话中调用。')))",
    "            h('p', { className: 'sm-page-sub' }, t('import.subtitle'))))"],

  // Dropzone.
  ["          'aria-label': '选择或拖入 .zip 技能包',", "          'aria-label': t('import.dropAria'),"],
  ["          h('h3', null, '把技能包拖到这里，或点击选择'),", "          h('h3', null, t('import.dropTitle')),"],
  ["          h('p', null, '支持的格式只有 .zip 压缩包，文件大小不能超过 50 MB。'),",
    "          h('p', null, t('import.dropNote')),"],
  ["              h(Icon, { name: 'i-folder', size: 16 }), '浏览文件…')))",
    "              h(Icon, { name: 'i-folder', size: 16 }), t('import.browse'))))"],

  // Counter cards.
  ["              h('div', { className: 'sm-k' }, '已导入'),", "              h('div', { className: 'sm-k' }, t('import.statImported')),"],
  ["              h('div', { className: 'sm-k' }, '已启用'),", "              h('div', { className: 'sm-k' }, t('import.statEnabled')),"],
  ["              h('div', { className: 'sm-k' }, '技能包格式'),", "              h('div', { className: 'sm-k' }, t('import.statFormat')),"],

  // Progress note.
  ["              `正在导入 ${String(importProgress.done + 1)}/${String(importProgress.total)}：${importProgress.name}…`),",
    "              t('import.progress', { done: importProgress.done + 1, total: importProgress.total, name: importProgress.name })),"],

  // Empty state.
  ["              title: '还没有本地技能',", "              title: t('import.empty'),"],
  ["              body: '把 .zip 技能包拖到上方区域，或点击「浏览文件…」导入。直接复制到技能目录的技能也会出现在这里。',",
    "              body: t('import.emptyBody'),"],
]
