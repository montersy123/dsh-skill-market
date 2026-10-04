/**
 * Batch 7 — the stats row, badges, and update states.
 *
 * The stats row glues a number to a noun (`2.4M 下载`), which is word order again: English needs
 * `2.4M downloads` and the two cannot be assembled from translated halves.
 */
export default [
  // Stats row on a card.
  ["        compact(skill.installs), ' 下载',", "        t('card.downloadsValue', { value: compact(skill.installs) }),"],
  ["        h('span', { className: 'sm-rating', title: '综合评分折算值' }, h(Star, null), skill.rating),",
    "        h('span', { className: 'sm-rating', title: t('card.ratingTitle') }, h(Star, null), skill.rating),"],
  ["        compact(skill.stars), ' 收藏')", "        t('card.savesValue', { value: compact(skill.stars) }))"],

  // Card accessible name and the official seal.
  ["        'aria-label': '查看 ' + skill.name,", "        'aria-label': t('card.view', { name: skill.name }),"],
  ["              skill.official ? h('span', { className: 'sm-verified', title: '官方技能' }, h(Verified, null)) : null),",
    "              skill.official ? h('span', { className: 'sm-verified', title: t('card.official') }, h(Verified, null)) : null),"],
]
