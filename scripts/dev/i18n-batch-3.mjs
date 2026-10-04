/**
 * Batch 3 — cards: bookmark, description fallback, install buttons, and the badge on list rows.
 *
 * Concatenated fragments become one key with a placeholder rather than translated pieces, because
 * word order differs between the languages and glueing translated halves produces broken sentences.
 */
export default [
  // Bookmark button on a card: the accessible label names the skill, the tooltip is short.
  ["        'aria-label': (saved ? '取消收藏 ' : '收藏 ') + name,",
    "        'aria-label': t(saved ? 'card.unsave' : 'card.save', { name }),"],
  ["        title: saved ? '取消收藏' : '收藏',",
    "        title: t(saved ? 'card.unsaveShort' : 'card.saveShort'),"],

  // Card description fallback.
  ["        h('p', { className: 'sm-card-desc' }, skill.description || '该技能未提供简介。'),",
    "        h('p', { className: 'sm-card-desc' }, skill.description || t('card.noDescription')),"],

  // Card install button, both states.
  ["              title: update.local === '' ? '已安装' : '本地 v' + update.local,",
    "              title: update.local === '' ? t('card.installed') : t('misc.localVersion', { version: update.local }),"],
  ["            }, h(Icon, { name: 'i-check', size: 15 }), '已安装')",
    "            }, h(Icon, { name: 'i-check', size: 15 }), t('card.installed'))"],
  ["            }, h(Icon, { name: 'i-download', size: 15 }), installing ? '安装中…' : '安装')))",
    "            }, h(Icon, { name: 'i-download', size: 15 }), t(installing ? 'card.installing' : 'card.install'))))"],

  // The drawer's install button and the list rows' badge.
  ["            }, h(Icon, { name: 'i-download', size: 14 }), '安装')))",
    "            }, h(Icon, { name: 'i-download', size: 14 }), t('card.install'))))"],

  // Saving toggles its toast; the name is a parameter.
  ["          notify(has ? '已取消收藏「' + skill.name + '」' : '已收藏「' + skill.name + '」')",
    "          notify(t(has ? 'action.unsavedNamed' : 'action.savedNamed', { name: skill.name }))"],
]
