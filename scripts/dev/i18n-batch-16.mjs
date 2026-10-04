/**
 * Batch 16 — the files tab: states, the preview header, and the tree summary.
 */
export default [
  ["          return h('p', { className: 'sm-body-note' }, '正在读取文件清单…')",
    "          return h('p', { className: 'sm-body-note' }, t('files.loading'))"],
  ["          return h('p', { className: 'sm-body-note' }, '本地导入的技能没有 SkillHub 文件清单。')",
    "          return h('p', { className: 'sm-body-note' }, t('files.localHasNone'))"],
  ["          return h('p', { className: 'sm-body-note' }, '文件清单加载失败：' + detail.reason)",
    "          return h('p', { className: 'sm-body-note' }, t('files.failed', { reason: detail.reason }))"],
  ["              }, h(Icon, { name: 'i-chevron-right', size: 13 }), '返回文件列表'),",
    "              }, h(Icon, { name: 'i-chevron-right', size: 13 }), t('files.back')),"],
  ["              ? h('p', { className: 'sm-body-note' }, '正在读取 ' + name + '…')",
    "              ? h('p', { className: 'sm-body-note' }, t('files.loadingOne', { path: name }))"],
  ["              ? h('p', { className: 'sm-body-note' }, '无法读取该文件：' + file.reason)",
    "              ? h('p', { className: 'sm-body-note' }, t('files.readFailed', { reason: file.reason }))"],
  ["              ? h('p', { className: 'sm-body-note' }, '文件较大，此处已截断显示。')",
    "              ? h('p', { className: 'sm-body-note' }, t('files.truncated'))"],
  ["              ? h('p', { className: 'sm-body-note' }, humanSize(file.bytes) + ' · 共 ' + String(file.text.split('\\n').length) + ' 行')",
    "              ? h('p', { className: 'sm-body-note' }, t('files.sizeAndLines', { size: humanSize(file.bytes), lines: file.text.split('\\n').length }))"],
  ["          return h('p', { className: 'sm-body-note' }, 'SkillHub 未返回该技能的文件清单。')",
    "          return h('p', { className: 'sm-body-note' }, t('files.none'))"],
  ["          h('h4', null, '文件'),", "          h('h4', null, t('files.heading')),"],
  ["            + (detail.filesVersion !== '' ? ' · 清单对应 v' + detail.filesVersion : '')",
    "            + (detail.filesVersion !== '' ? t('files.manifestVersion', { version: detail.filesVersion }) : '')"],
]
