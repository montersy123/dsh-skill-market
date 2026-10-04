/**
 * Batch 8 — publisher fallback, category fallback, and unknown-skill naming.
 */
export default [
  ["      return skill.publisher || skill.handle || 'SkillHub 社区'",
    "      return skill.publisher || skill.handle || t('misc.community')"],
  ["      const categoryName = categories.find((c) => c.key === categoryKey)?.name ?? categoryKey ?? '未分类'",
    "      const categoryName = translatedCategory(categoryKey, categories.find((c) => c.key === categoryKey)?.name ?? categoryKey ?? t('overview.unknownCategory'))"],
  ["        name: String(raw?.name ?? slug ?? '未知技能'),",
    "        name: String(raw?.name ?? slug ?? t('overview.unknownSkill')),"],
]
