/**
 * Batch 4 — categories, risk labels, and relative time.
 *
 * The fallback category list carries keys rather than text now, so the label follows the active
 * language. Risk labels become keys for the same reason.
 */
export default [
  // Fallback category list: `name` is a dictionary key, resolved where it renders.
  ["      { key: 'office-efficiency', name: '办公效率' },", "      { key: 'office-efficiency', name: 'category.office-efficiency' },"],
  ["      { key: 'content-creation', name: '内容创作' },", "      { key: 'content-creation', name: 'category.content-creation' },"],
  ["      { key: 'dev-programming', name: '开发编程' },", "      { key: 'dev-programming', name: 'category.dev-programming' },"],
  ["      { key: 'data-analysis', name: '数据分析' },", "      { key: 'data-analysis', name: 'category.data-analysis' },"],
  ["      { key: 'design-media', name: '设计多媒体' },", "      { key: 'design-media', name: 'category.design-media' },"],
  ["      { key: 'knowledge-management', name: '知识管理' },", "      { key: 'knowledge-management', name: 'category.knowledge-management' },"],
  ["      { key: 'business-ops', name: '商业运营' },", "      { key: 'business-ops', name: 'category.business-ops' },"],
  ["      { key: 'education', name: '教育学习' },", "      { key: 'education', name: 'category.education' },"],
  ["      { key: 'professional', name: '行业专业' },", "      { key: 'professional', name: 'category.professional' },"],
  ["      { key: 'it-ops-security', name: 'IT 运维与安全' },", "      { key: 'it-ops-security', name: 'category.it-ops-security' },"],
  ["      { key: 'life-service', name: '生活服务' },", "      { key: 'life-service', name: 'category.life-service' },"],

  // Risk copy.
  ["    const RISK_LABELS = { low: '低风险', mid: '中风险', high: '高风险' }",
    "    const RISK_LABELS = { low: 'risk.low', mid: 'risk.mid', high: 'risk.high' }"],

  // The panel's category resolver: falls back to the shipped label for a key with no upstream name.
  ["        if (key === '' || key === undefined || key === null) return '未分类'\n        return categories.find((entry) => entry.key === key)?.name ?? key",
    "        if (key === '' || key === undefined || key === null) return t('overview.unknownCategory')\n        const upstream = categories.find((entry) => entry.key === key)?.name\n        // Upstream sends a Chinese display name; the dictionary can override it per language.\n        return translatedCategory(key, upstream ?? key)"],
]
