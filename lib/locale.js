/**
 * Translation for the skill-market panel.
 *
 * ## How this hooks into DSH
 *
 * The DSH client locale service exposes:
 *
 *   register(ns, { zh, en })   both built-in locales are required in one call
 *   bind(ns) -> (key, params) => string
 *
 * `bind` caches its function and resolves against the service's snapshot **when called**, not when
 * bound, so one binding made at module load keeps working after the user switches language in
 * 设置 → 常规. That is why `setTranslator` is called once from `apply()` and the returned reference is
 * captured here.
 *
 * ## Why a fallback exists
 *
 * `createTranslator` is used when no locale service is injected — a harness, or a Host build without
 * the client locale package. It returns the Chinese source text, which is what the panel rendered
 * before translation existed, so an environment without the service degrades to the previous
 * behaviour rather than to a screen of raw keys.
 *
 * ## Placeholders
 *
 * Values are `{name}`-style, substituted by `format`. Number formatting stays at the call site: a
 * count is formatted for the active language before it is passed in, so the dictionary never has to
 * know about digits.
 */

/** Locale namespace, matching the `locale: NS` already declared on the slot registrations. */
export const NS = '@montersy123/dsh-skill-market'

/**
 * Chinese strings keyed by translation key.
 *
 * Also the source of truth for defaults: an unknown key resolves to whatever this file says, so a
 * missing entry shows Chinese text rather than the key.
 * @type {Record<string, string>}
 */
export const ZH = {
  // ── shell ──────────────────────────────────────────────────────────────
  'view.discover': '发现',
  'view.installed': '已安装',
  'view.saved': '收藏',
  // Drawer tabs. Named 安全扫描 rather than 安全 on purpose: the tab holds a scan's results, and a tab
  // called 安全 reads as the panel asserting the skill is safe before it has said anything.
  'tab.overview': '概览',
  'tab.files': '文件',
  'tab.versions': '版本历史',
  'tab.permissions': '权限',
  'tab.safety': '安全扫描',
  'tab.metrics': '指标',
  'view.import': '本地导入',
  'panel.title': '技能市场',
  'panel.aria': '技能市场视图',

  // ── discover ───────────────────────────────────────────────────────────
  'discover.eyebrow': 'DISCOVER',
  'discover.title': '发现技能',
  'discover.subtitle': '来自 SkillHub 的技能库，默认按下载量排序。安装后即可在任意会话中直接调用。',
  'discover.all': '全部技能',
  'discover.chipTitle': '{name}：共 {count} 个（不受当前筛选影响）',
  'discover.total': '共 {total} 个',
  'discover.pageOf': '（本页 {shown} 个）',
  'sort.aria': '排序方式',
  'sort.downloads': '按下载量',
  'sort.score': '按综合评分',
  'sort.stars': '按收藏数',
  'sort.updated': '按更新时间',
  'search.placeholder': '搜索技能、描述或关键词',
  'search.refresh': '刷新技能数据',
  'search.refreshShort': '刷新',
  'status.connected': '已连接 SkillHub',
  'status.syncing': '正在同步 SkillHub',
  'status.error': 'SkillHub 连接异常',
  'status.loading': '加载中…',

  // ── cards and rows ─────────────────────────────────────────────────────
  'card.view': '查看 {name}',
  'card.official': '官方技能',
  'card.noDescription': '该技能未提供简介。',
  'card.save': '收藏 {name}',
  'card.unsave': '取消收藏 {name}',
  'card.saveShort': '收藏',
  'card.unsaveShort': '取消收藏',
  'card.install': '安装',
  'card.installed': '已安装',
  'card.installNamed': '安装「{name}」',
  'card.installing': '安装中…',
  'card.loadMore': '加载更多',
  'card.showing': '已显示 {shown} / {total}',
  'card.showingAll': '已显示全部 {total} 个技能',
  'card.downloads': '下载量',
  'card.saved': '收藏',
  'card.saves': '收藏数',
  'card.stars': '收藏数',
  'card.score': '综合评分',
  'card.rating': '评分折算',
  'card.ratingTitle': '综合评分折算值',
  'card.version': '版本',
  'card.source': '来源',
  'card.category': '分类',
  'card.firstSeen': '首次收录',
  'card.updatedAt': '最近更新',
  'card.identifier': '标识',
  'card.categoryLabel': '分类：{name}',
  'card.from': '来自 {source}，标识 {canonical}',

  // ── empty and error states ─────────────────────────────────────────────
  'empty.noMatch': '没有匹配的技能',
  'empty.noMatchBody': '换个关键词，或清空分类筛选后再试。',
  'empty.noInstalled': '还没有安装技能',
  'empty.noInstalledBody': '到技能市场挑选一个开始吧。',
  'empty.noSaved': '收藏夹是空的',
  'empty.goDiscover': '去发现技能',
  'empty.noSavedBody': '在技能卡片上点击书签图标即可收藏。',
  'error.catalog': '技能数据加载失败',
  'error.retry': '重试',
  'error.prunedFavorites': '已清理 {count} 个无法解析的旧收藏',

  // ── installed view ─────────────────────────────────────────────────────
  'installed.eyebrow': 'LIBRARY',
  'installed.subtitle': '{count} 个技能已加入本地技能库，可随时停用而不卸载。',
  'installed.pendingBadge': '待生效',
  'installed.pendingBadgeTitle': '本次已修改，重启后对新会话生效',
  'installed.disabled': '已停用',
  'installed.enabled': '已启用',
  'installed.toggleLabel': '启用 / 停用',
  'installed.enableNamed': '启用 {name}',
  'installed.removeNamed': '移除 {name}',
  'installed.remove': '移除',
  'installed.details': '详情',
  'installed.version': '版本 {version}',
  'installed.noVersion': '版本未标注',
  'installed.dirPrefix': 'skill 目录：',
  'installed.installedAt': '安装于 {time}',
  'installed.fileCount': '（{count} 个文件）',
  'installed.fileCountBare': '{count} 个文件',

  // ── restart advice ─────────────────────────────────────────────────────
  'restart.bannerTitle': '本次改了 {count} 个技能',
  'restart.effect': '重启 DeepSeek Harness 后生效',
  'restart.dismiss': '知道了',
  'restart.dismissTitle': '只是清掉这个提示，不影响技能状态',
  'toast.undo': '撤销',

  // ── saved view ─────────────────────────────────────────────────────────
  'saved.eyebrow': 'COLLECTION',
  'saved.subtitle': '{count} 个技能已收藏，仅保存在本机。',
  'saved.update': '更新',
  'saved.versionArrow': 'v{local} → v{latest}',
  'saved.updated': '已更新',
  'saved.updatable': '可更新',
  'saved.upToDate': '已是 SkillHub 上的最新版本',

  // ── local import ───────────────────────────────────────────────────────
  'import.eyebrow': 'LOCAL',
  'import.subtitle': '导入当前设备上的技能包，仅在本地生效，不会同步到市场或团队工作区。导入后即可在任意会话中调用。',
  'import.dropTitle': '把技能包拖到这里，或点击选择',
  'import.dropNote': '支持的格式只有 .zip 压缩包，文件大小不能超过 50 MB。',
  'import.dropAria': '选择或拖入 .zip 技能包',
  'import.browse': '浏览文件…',
  'import.statImported': '已导入',
  'import.statEnabled': '已启用',
  'import.statFormat': '技能包格式',
  'import.progress': '正在导入 {done}/{total}：{name}…',
  'import.empty': '还没有本地技能',
  'import.emptyBody': '把 .zip 技能包拖到上方区域，或点击「浏览文件…」导入。直接复制到技能目录的技能也会出现在这里。',
  'import.badgeLocal': '本地导入',
  'import.badgeManual': '手动放置',
  'import.pickFile': '导入技能',
  'import.doneOne': '已导入「{name}」',
  'import.doneMany': '已导入 {count} 个技能包',
  'import.doneMixed': '已导入 {ok} 个，{failed} 个失败：{reason}',
  'import.failed': '导入失败：{reason}',
  'import.fileFailed': '{name}：{reason}',
  'import.noResult': 'Host 未返回导入结果',
  'import.noResultDetail': 'Host 未返回导入结果（响应：{body}）',

  // ── drawer: overview ───────────────────────────────────────────────────
  'drawer.aria': '技能详情',
  'drawer.close': '关闭详情',
  'drawer.installSkill': '安装技能',
  'drawer.uninstallInstalled': '已安装 · 卸载',
  'drawer.savedState': '已收藏',
  'drawer.sourceOfficial': '官方来源',
  'drawer.sourceCommunity': '社区来源',
  'drawer.updatedAt': '更新于 {time}',
  'drawer.versionUnknown': '版本未标注',
  'overview.summary': '简介',
  'overview.keyInfo': '关键信息',
  'overview.useCases': '适用场景',
  'overview.fromOfficial': '来自 SkillHub 认证，标识 {canonical}',
  'overview.fromCommunity': '来自 SkillHub 社区，标识 {canonical}',
  'overview.version': '当前版本 v{version}',
  'overview.versionMaintained': '版本信息由作者维护',
  'overview.needsKey': '需要自备 API Key',
  'overview.noKey': '无需额外 API Key',
  'overview.summaryFailed': '简介加载失败：{reason}',
  'overview.installedHint': '已安装的技能；打开详情可读取 SkillHub 上的说明。',
  'overview.unknownSkill': '未知技能',
  'overview.unknownCategory': '未分类',

  // ── drawer: files ──────────────────────────────────────────────────────
  'files.loading': '正在读取文件清单…',
  'files.localHasNone': '本地导入的技能没有 SkillHub 文件清单。',
  'files.failed': '文件清单加载失败：{reason}',
  'files.none': 'SkillHub 未返回该技能的文件清单。',
  'files.back': '返回文件列表',
  'files.truncated': '文件较大，此处已截断显示。',
  'files.readFailed': '无法读取该文件：{reason}',
  'files.noSource': '该技能没有 SkillHub 来源',
  'files.unknownSize': '未知大小',
  'files.loadingOne': '正在读取 {path}',
  'files.heading': '文件',
  'files.sizeAndLines': '{size} · 共 {lines} 行',
  'files.treeSummary': '{files} 个文件 · {size} · {version} · 点击文件查看内容',
  'files.treeSummaryNoVersion': '{files} 个文件 · {size} · 点击查看内容',
  'files.treeSummaryBase': '{files} 个文件 · {size}',
  'files.treeHint': ' · 点击文件查看内容',
  'files.nodeSummary': '{files} 个文件 · {size}',
  'files.nodeTitle': '{path} · 点击查看内容',
  'files.manifestVersion': '清单对应 v{version}',

  // ── drawer: versions ───────────────────────────────────────────────────
  'versions.loading': '正在读取版本历史…',
  'versions.failed': '版本历史加载失败：{reason}',
  'versions.localHasNone': '本地导入的技能没有 SkillHub 版本历史。',
  'versions.none': 'SkillHub 未返回版本记录。',
  'versions.installed': '已安装',
  'versions.latest': '最新',
  'versions.installThis': '安装',
  'versions.expand': '展开其余 {count} 个版本',
  'versions.collapse': '收起历史版本',
  'versions.noChangelog': '作者未填写更新说明',
  'versions.currentVersion': '当前版本',
  'versions.newAvailable': '有新版本可用',
  'versions.upToDate': '已是 SkillHub 上的最新版本',
  'versions.updateTo': '更新到 v{version}',
  'versions.versionAndSource': '版本与来源',
  'versions.heading': '版本历史',
  'versions.comparison': '本地 v{local} · SkillHub v{latest}',
  'versions.updatedAtValue': '{date}（{relative}）',
  'versions.category': '分类',
  'versions.source': '来源',
  'versions.identifier': '标识',
  'versions.firstSeen': '首次收录',
  'versions.updatedAt': '最近更新',

  // ── drawer: permissions ────────────────────────────────────────────────
  'perm.heading': '需要的权限',
  'perm.note': '以下说明区分技能自身的声明与本插件的行为，你可以在设置中随时收回。',
  'perm.network': '网络访问',
  'perm.networkDesc': '技能自身可能访问外部服务；{key}',
  'perm.needsKey': '作者标注需要自备 API Key。',
  'perm.noKeyNote': '作者未标注需要 API Key。',
  'perm.metadata': '读取技能元数据',
  'perm.metadataDesc': '本插件仅从 SkillHub 读取公开的名称、简介、版本与统计信息，不写入你的任何数据。',
  'perm.localLibrary': '本地技能库',
  'perm.localLibraryDesc': '「安装」只在本机记录该技能并启用；技能文件本身仍由你通过本地导入提供。',
  'risk.low': '低风险',
  'risk.mid': '中风险',
  'risk.high': '高风险',

  // ── drawer: safety ─────────────────────────────────────────────────────
  'safety.heading': '安全扫描',
  'safety.note': '结果由 SkillHub 的第三方检测方给出，与「权限」页说明的本插件行为无关。',
  'safety.loading': '正在读取检测结果…',
  'safety.failed': '检测结果读取失败：{reason}',
  'safety.none': 'SkillHub 未提供该技能的安全检测结果。',
  'safety.allBenign': '所有检测方均报告安全，无风险',
  'safety.hasRisk': '有检测方报告可疑，存在潜在风险',
  'safety.pending': '检测仍在排队中',
  'safety.unknown': '检测结果未明',
  'safety.badge': '安全',
  'safety.badgeTitle': '安全扫描通过：所有检测方均报告安全，无风险',
  'safety.report': '查看报告',
  'safety.shownNote': '卡片与详情页的「安全」标记只在全部检测方都报告安全时出现。',
  'safety.hiddenNote': '「安全」标记只在全部检测方都报告安全时出现，因此当前不显示该标记。',

  // ── drawer: metrics ────────────────────────────────────────────────────
  'metrics.heading': 'SkillHub 指标',
  'metrics.note': '全部数值直接来自 SkillHub 公开接口。',
  'metrics.downloads': '下载量',
  'metrics.stars': '收藏数',
  'metrics.score': '综合评分',
  'metrics.rating': '评分折算',
  'metrics.homepage': '主页',
  'metrics.total': 'SkillHub 共 {total}',

  // ── actions and confirmations ──────────────────────────────────────────
  'action.install': '安装',
  'action.update': '更新',
  'action.uninstall': '卸载',
  'action.uninstallNamed': '卸载 {name}',
  'action.uninstalling': '卸载「{name}」？',
  'action.uninstallBody': '技能目录会从磁盘删除，已停用的技能也会一并移除，卸载后需要重新下载才能恢复。',
  'action.uninstallDetail': '{directory}（{files} 个文件）',
  'action.uninstallDetailNoFiles': '{directory}',
  'action.downgrade': '回退「{name}」到 v{version}？',
  'action.downgradeBody': '当前安装的是 v{current}。技能目录会被替换为该旧版本的完整文件。',
  'action.downgradeConfirm': '回退',
  'action.cancel': '取消',
  'action.confirmInstall': '安装「{name}」',
  'action.noInstallResult': 'Host 未返回安装结果',
  'action.enableNamed': '已启用「{name}」',
  'action.disableNamed': '已停用「{name}」',
  'action.installedNamed': '已安装「{name}」',
  'action.updatedNamed': '已更新「{name}」',
  'action.uninstalledNamed': '已卸载「{name}」',
  'action.removedFromDisabled': '已从停用目录移除「{name}」',
  'action.installedDetail': '已安装「{name}」v{version}：{files} 个文件 → {directory}，重启 DeepSeek Harness 后生效',
  'action.updatedParked': '已更新「{name}」v{version}：{files} 个文件已写入停用目录，技能仍处于停用状态',
  'action.removeFromDisabled': '已从停用目录移除「{name}」，重启 DeepSeek Harness 后生效',
  'action.uninstalledRestart': '已卸载「{name}」，重启 DeepSeek Harness 后生效',
  'action.enableRestart': '已启用「{name}」，重启 DeepSeek Harness 后生效',
  'action.disableRestart': '已停用「{name}」，重启 DeepSeek Harness 后生效',
  'action.installingNamed': '正在安装「{name}」…',
  'action.installingVersion': '正在安装「{name}」v{version}…',
  'action.installFailed': '安装「{name}」失败：{reason}',
  'action.uninstallFailed': '卸载「{name}」失败：{reason}',
  'action.toggleFailed': '切换「{name}」失败：{reason}',
  'action.detailFailed': '详情加载失败：{reason}',
  'action.importFailedNamed': '导入「{name}」失败：{reason}',
  'action.savedNamed': '已收藏「{name}」',
  'action.unsavedNamed': '已取消收藏「{name}」',
  'action.tooLarge': '技能目录过大（{size} MB > {limit} MB）',
  'action.tooManyFiles': '文件数超出上限（{limit}）',

  // ── API and client errors ──────────────────────────────────────────────
  'err.notJson': '技能市场接口返回了非 JSON 内容（HTTP {status}）',
  'err.offline': '连不上技能市场，请检查网络后重试',
  'err.requestFailed': '技能市场接口请求失败（HTTP {status}）',
  'err.timeout': '技能市场响应超时，请稍后重试',
  'err.upstreamFailed': '技能市场上游请求失败：{reason}',
  'err.uploadFailed': '上传失败（HTTP {status}）',

  // ── relative time ──────────────────────────────────────────────────────
  'time.justNow': '刚刚',
  'time.minutes': '{count} 分钟前',
  'time.hours': '{count} 小时前',
  'time.days': '{count} 天前',
  'time.months': '{count} 个月前',
  'time.years': '{count} 年前',

  // ── upstream categories ────────────────────────────────────────────────
  // Keys are the upstream `category` values, verified against the captured fixture and the
  // `FALLBACK_CATEGORIES` list rather than guessed: `knowledge-management`, `professional`,
  // `it-ops-security` and `life-service` are the real spellings, and `ai-agent` has no Chinese name
  // upstream, so it stays as it is.
  'category.dev-programming': '开发编程',
  'category.data-analysis': '数据分析',
  'category.content-creation': '内容创作',
  'category.office-efficiency': '办公效率',
  'category.design-media': '设计多媒体',
  'category.ai-agent': 'AI Agent',
  'category.knowledge-management': '知识管理',
  'category.business-ops': '商业运营',
  'category.education': '教育学习',
  'category.professional': '行业专业',
  'category.it-ops-security': 'IT 运维与安全',
  'category.life-service': '生活服务',

  // ── misc ───────────────────────────────────────────────────────────────
  'misc.official': '官方',
  'misc.community': '社区',
  'misc.localMachine': '本机',
  'misc.machineRecord': '本机记录',
  'misc.unknown': '未知',
  'misc.notStated': '未标注',
  'misc.localVersion': '本地 v{version}',
  'misc.byAuthor': '作者未填写更新说明',
  'misc.vendorKeen': '科恩实验室',
  'misc.vendorSanbu': '云鼎实验室',
}

/**
 * English strings, keyed identically to {@link ZH}.
 * @type {Record<string, string>}
 */
export const EN = {
  'view.discover': 'Discover',
  'view.installed': 'Installed',
  'view.saved': 'Saved',
  'tab.overview': 'Overview',
  'tab.files': 'Files',
  'tab.versions': 'Version',
  'tab.permissions': 'Permissions',
  'tab.safety': 'Security',
  'tab.metrics': 'Metrics',
  'view.import': 'Local import',
  'panel.title': 'Skill Market',
  'panel.aria': 'Skill market view',

  'discover.eyebrow': 'DISCOVER',
  'discover.title': 'Discover skills',
  'discover.subtitle': 'Skills from SkillHub, most downloaded first. Install one to call it from any conversation.',
  'discover.all': 'All skills',
  'discover.chipTitle': '{name}: {count} total (not affected by the current filter)',
  'discover.total': '{total} skills',
  'discover.pageOf': ' ({shown} on this page)',
  'sort.aria': 'Sort order',
  'sort.downloads': 'Most downloaded',
  'sort.score': 'Highest rated',
  'sort.stars': 'Most saved',
  'sort.updated': 'Recently updated',
  'search.placeholder': 'Search skills, descriptions or keywords',
  'search.refresh': 'Refresh skill data',
  'search.refreshShort': 'Refresh',
  'status.connected': 'Connected to SkillHub',
  'status.syncing': 'Syncing with SkillHub',
  'status.error': 'SkillHub connection problem',
  'status.loading': 'Loading…',

  'card.view': 'View {name}',
  'card.official': 'Official skill',
  'card.noDescription': 'This skill has no description.',
  'card.save': 'Save {name}',
  'card.unsave': 'Remove {name} from saved',
  'card.saveShort': 'Save',
  'card.unsaveShort': 'Saved',
  'card.install': 'Install',
  'card.installed': 'Installed',
  'card.installNamed': 'Install “{name}”',
  'card.installing': 'Installing…',
  'card.loadMore': 'Load more',
  'card.showing': 'Showing {shown} / {total}',
  'card.showingAll': 'All {total} skills shown',
  'card.downloads': 'Downloads',
  'card.saved': 'Saved',
  'card.saves': 'Saves',
  'card.stars': 'Saves',
  'card.score': 'Score',
  'card.rating': 'Rating',
  'card.ratingTitle': 'Score converted to a 5-point rating',
  'card.version': 'Version',
  'card.source': 'Source',
  'card.category': 'Category',
  'card.firstSeen': 'First seen',
  'card.updatedAt': 'Last updated',
  'card.identifier': 'Identifier',
  'card.categoryLabel': 'Category: {name}',
  'card.from': 'From {source}, identifier {canonical}',

  'empty.noMatch': 'No matching skills',
  'empty.noMatchBody': 'Try another keyword, or clear the category filter.',
  'empty.noInstalled': 'No skills installed yet',
  'empty.noInstalledBody': 'Pick one from the market to get started.',
  'empty.noSaved': 'Nothing saved yet',
  'empty.goDiscover': 'Browse skills',
  'empty.noSavedBody': 'Click the bookmark icon on a skill card to save it.',
  'error.catalog': 'Could not load skill data',
  'error.retry': 'Retry',
  'error.prunedFavorites': 'Cleared {count} saved entries that could no longer be resolved',

  'installed.eyebrow': 'LIBRARY',
  'installed.subtitle': '{count} skill(s) in your local library. Disable one at any time without uninstalling it.',
  'installed.pendingBadge': 'Pending',
  'installed.pendingBadgeTitle': 'Changed this session; takes effect in new conversations after a restart',
  'installed.disabled': 'Disabled',
  'installed.enabled': 'Enabled',
  'installed.toggleLabel': 'Enable / disable',
  'installed.enableNamed': 'Enable {name}',
  'installed.removeNamed': 'Remove {name}',
  'installed.remove': 'Remove',
  'installed.details': 'Details',
  'installed.version': 'Version {version}',
  'installed.noVersion': 'Version not stated',
  'installed.dirPrefix': 'skill directory: ',
  'installed.installedAt': 'installed {time}',
  'installed.fileCount': ' ({count} files)',
  'installed.fileCountBare': '{count} files',

  'restart.bannerTitle': '{count} skill(s) changed',
  'restart.effect': 'Restart DeepSeek Harness to apply',
  'restart.dismiss': 'Got it',
  'restart.dismissTitle': 'Dismisses this notice only; skill state is unaffected',
  'toast.undo': 'Undo',

  'saved.eyebrow': 'COLLECTION',
  'saved.subtitle': '{count} skill(s) saved, on this machine only.',
  'saved.update': 'Update',
  'saved.versionArrow': 'v{local} → v{latest}',
  'saved.updated': 'Updated',
  'saved.updatable': 'Update available',
  'saved.upToDate': 'Already the latest version on SkillHub',

  'import.eyebrow': 'LOCAL',
  'import.subtitle': 'Import a skill package from this device. It stays local and is not synced to the market or a team workspace, and can be called from any conversation once imported.',
  'import.dropTitle': 'Drop a skill package here, or click to choose',
  'import.dropNote': 'Only .zip archives are supported, up to 50 MB each.',
  'import.dropAria': 'Choose or drop a .zip skill package',
  'import.browse': 'Browse files…',
  'import.statImported': 'Imported',
  'import.statEnabled': 'Enabled',
  'import.statFormat': 'Package format',
  'import.progress': 'Importing {done}/{total}: {name}…',
  'import.empty': 'No local skills yet',
  'import.emptyBody': 'Drop a .zip package above, or click “Browse files…”. Skills copied straight into the skill directory appear here too.',
  'import.badgeLocal': 'Imported',
  'import.badgeManual': 'Placed by hand',
  'import.pickFile': 'Import skill',
  'import.doneOne': 'Imported “{name}”',
  'import.doneMany': 'Imported {count} skill packages',
  'import.doneMixed': 'Imported {ok}, {failed} failed: {reason}',
  'import.failed': 'Import failed: {reason}',
  'import.fileFailed': '{name}: {reason}',
  'import.noResult': 'The Host did not return an import result',
  'import.noResultDetail': 'The Host did not return an import result (response: {body})',

  'drawer.aria': 'Skill details',
  'drawer.close': 'Close details',
  'drawer.installSkill': 'Install skill',
  'drawer.uninstallInstalled': 'Installed · uninstall',
  'drawer.savedState': 'Saved',
  'drawer.sourceOfficial': 'Official source',
  'drawer.sourceCommunity': 'Community source',
  'drawer.updatedAt': 'Updated {time}',
  'drawer.versionUnknown': 'Version not stated',
  'overview.summary': 'Summary',
  'overview.keyInfo': 'Key facts',
  'overview.useCases': 'When to use it',
  'overview.fromOfficial': 'From SkillHub verified, identifier {canonical}',
  'overview.fromCommunity': 'From the SkillHub community, identifier {canonical}',
  'overview.version': 'Current version v{version}',
  'overview.versionMaintained': 'Version information is maintained by the author',
  'overview.needsKey': 'You must supply your own API key',
  'overview.noKey': 'No extra API key needed',
  'overview.summaryFailed': 'Could not load the summary: {reason}',
  'overview.installedHint': 'An installed skill. Open the details to read its description on SkillHub.',
  'overview.unknownSkill': 'Unknown skill',
  'overview.unknownCategory': 'Uncategorised',

  'files.loading': 'Reading the file list…',
  'files.localHasNone': 'A locally imported skill has no SkillHub file list.',
  'files.failed': 'Could not load the file list: {reason}',
  'files.none': 'SkillHub returned no file list for this skill.',
  'files.back': 'Back to the file list',
  'files.truncated': 'This file is large; the preview is truncated.',
  'files.readFailed': 'Could not read this file: {reason}',
  'files.noSource': 'This skill has no SkillHub source',
  'files.unknownSize': 'Unknown size',
  'files.loadingOne': 'Reading {path}',
  'files.heading': 'Files',
  'files.sizeAndLines': '{size} · {lines} line(s)',
  'files.treeSummary': '{files} file(s) · {size} · {version} · click a file to read it',
  'files.treeSummaryNoVersion': '{files} file(s) · {size} · click a file to read it',
  'files.treeSummaryBase': '{files} file(s) · {size}',
  'files.treeHint': ' · click a file to read it',
  'files.nodeSummary': '{files} file(s) · {size}',
  'files.nodeTitle': '{path} · click to read',
  'files.manifestVersion': 'list matches v{version}',

  'versions.loading': 'Reading version history…',
  'versions.failed': 'Could not load version history: {reason}',
  'versions.localHasNone': 'A locally imported skill has no SkillHub version history.',
  'versions.none': 'SkillHub returned no version records.',
  'versions.installed': 'Installed',
  'versions.latest': 'Latest',
  'versions.installThis': 'Install',
  'versions.expand': 'Show the other {count} version(s)',
  'versions.collapse': 'Hide older versions',
  'versions.noChangelog': 'No release notes from the author',
  'versions.currentVersion': 'Current version',
  'versions.newAvailable': 'A newer version is available',
  'versions.upToDate': 'Already the latest version on SkillHub',
  'versions.updateTo': 'Update to v{version}',
  'versions.versionAndSource': 'Version and source',
  'versions.heading': 'Version history',
  'versions.comparison': 'local v{local} · SkillHub v{latest}',
  'versions.updatedAtValue': '{date} ({relative})',
  'versions.category': 'Category',
  'versions.source': 'Source',
  'versions.identifier': 'Identifier',
  'versions.firstSeen': 'First seen',
  'versions.updatedAt': 'Last updated',

  'perm.heading': 'Permissions needed',
  'perm.note': 'These notes separate what the skill itself declares from what this plugin does. You can revoke them in Settings at any time.',
  'perm.network': 'Network access',
  'perm.networkDesc': 'The skill itself may call external services; {key}',
  'perm.needsKey': 'the author states you must supply an API key.',
  'perm.noKeyNote': 'the author states no API key is needed.',
  'perm.metadata': 'Reads skill metadata',
  'perm.metadataDesc': 'This plugin only reads public names, descriptions, versions and statistics from SkillHub. It writes none of your data.',
  'perm.localLibrary': 'Local skill library',
  'perm.localLibraryDesc': '“Install” only records and enables the skill on this machine; you still supply the skill files through local import.',
  'risk.low': 'Low risk',
  'risk.mid': 'Medium risk',
  'risk.high': 'High risk',

  'safety.heading': 'Security scan',
  'safety.note': 'Results come from SkillHub’s third-party scanners and are unrelated to this plugin’s own behaviour described under Permissions.',
  'safety.loading': 'Reading scan results…',
  'safety.failed': 'Could not read scan results: {reason}',
  'safety.none': 'SkillHub provides no security scan for this skill.',
  'safety.allBenign': 'Every scanner reports safe, no risk',
  'safety.hasRisk': 'A scanner reports suspicious, potential risk',
  'safety.pending': 'The scan is still queued',
  'safety.unknown': 'Scan result unclear',
  'safety.badge': 'Safe',
  'safety.badgeTitle': 'Scan passed: every scanner reports safe, no risk',
  'safety.report': 'View report',
  'safety.shownNote': 'The “Safe” mark on cards and here appears only when every scanner reports safe.',
  'safety.hiddenNote': 'The “Safe” mark appears only when every scanner reports safe, so it is not shown here.',

  'metrics.heading': 'SkillHub metrics',
  'metrics.note': 'All values come directly from SkillHub’s public API.',
  'metrics.downloads': 'Downloads',
  'metrics.stars': 'Saves',
  'metrics.score': 'Score',
  'metrics.rating': 'Rating',
  'metrics.homepage': 'Homepage',
  'metrics.total': '{total} skills on SkillHub',

  'action.install': 'Install',
  'action.update': 'Update',
  'action.uninstall': 'Uninstall',
  'action.uninstallNamed': 'Uninstall {name}',
  'action.uninstalling': 'Uninstall “{name}”?',
  'action.uninstallBody': 'The skill directory is deleted from disk, including a disabled copy. Reinstalling requires downloading it again.',
  'action.uninstallDetail': '{directory} ({files} files)',
  'action.uninstallDetailNoFiles': '{directory}',
  'action.downgrade': 'Roll “{name}” back to v{version}?',
  'action.downgradeBody': 'v{current} is currently installed. The skill directory is replaced with that older release in full.',
  'action.downgradeConfirm': 'Roll back',
  'action.cancel': 'Cancel',
  'action.confirmInstall': 'Install “{name}”',
  'action.noInstallResult': 'The Host did not return an install result',
  'action.enableNamed': 'Enabled “{name}”',
  'action.disableNamed': 'Disabled “{name}”',
  'action.installedNamed': 'Installed “{name}”',
  'action.updatedNamed': 'Updated “{name}”',
  'action.uninstalledNamed': 'Uninstalled “{name}”',
  'action.removedFromDisabled': 'Removed “{name}” from the disabled store',
  'action.installedDetail': 'Installed “{name}” v{version}: {files} files → {directory}. Restart DeepSeek Harness to apply.',
  'action.updatedParked': 'Updated “{name}” v{version}: {files} files written to the disabled store; the skill stays disabled',
  'action.removeFromDisabled': 'Removed “{name}” from the disabled store. Restart DeepSeek Harness to apply.',
  'action.uninstalledRestart': 'Uninstalled “{name}”. Restart DeepSeek Harness to apply.',
  'action.enableRestart': 'Enabled “{name}”. Restart DeepSeek Harness to apply.',
  'action.disableRestart': 'Disabled “{name}”. Restart DeepSeek Harness to apply.',
  'action.installingNamed': 'Installing “{name}”…',
  'action.installingVersion': 'Installing “{name}” v{version}…',
  'action.installFailed': 'Could not install “{name}”: {reason}',
  'action.uninstallFailed': 'Could not uninstall “{name}”: {reason}',
  'action.toggleFailed': 'Could not switch “{name}”: {reason}',
  'action.detailFailed': 'Could not load details: {reason}',
  'action.importFailedNamed': 'Could not import “{name}”: {reason}',
  'action.savedNamed': 'Saved “{name}”',
  'action.unsavedNamed': 'Removed “{name}” from saved',
  'action.tooLarge': 'Skill directory too large ({size} MB > {limit} MB)',
  'action.tooManyFiles': 'Too many files (limit {limit})',

  'err.notJson': 'The skill-market API returned something that is not JSON (HTTP {status})',
  'err.offline': 'Could not reach the skill market — check your network and retry',
  'err.requestFailed': 'Skill-market API request failed (HTTP {status})',
  'err.timeout': 'The skill market did not answer in time — try again shortly',
  'err.upstreamFailed': 'SkillHub request failed: {reason}',
  'err.uploadFailed': 'Upload failed (HTTP {status})',

  'time.justNow': 'just now',
  'time.minutes': '{count} min ago',
  'time.hours': '{count} h ago',
  'time.days': '{count} d ago',
  'time.months': '{count} mo ago',
  'time.years': '{count} y ago',

  'category.dev-programming': 'Development',
  'category.data-analysis': 'Data analysis',
  'category.content-creation': 'Content creation',
  'category.office-efficiency': 'Office efficiency',
  'category.design-media': 'Design and media',
  'category.ai-agent': 'AI agent',
  'category.knowledge-management': 'Knowledge management',
  'category.business-ops': 'Business operations',
  'category.education': 'Education',
  'category.professional': 'Industry',
  'category.it-ops-security': 'IT operations and security',
  'category.life-service': 'Everyday services',

  'misc.official': 'Official',
  'misc.community': 'Community',
  'misc.localMachine': 'This machine',
  'misc.machineRecord': 'Local record',
  'misc.unknown': 'Unknown',
  'misc.notStated': 'not stated',
  'misc.localVersion': 'local v{version}',
  'misc.byAuthor': 'No release notes from the author',
  'misc.vendorKeen': 'Keen Lab',
  'misc.vendorSanbu': 'Yunding Lab',
}

/**
 * Substitute `{name}` placeholders.
 *
 * A missing parameter is left as the placeholder rather than dropped, so a mistake shows up in the
 * rendered text instead of silently producing a sentence with a hole in it.
 *
 * @param {string} template - Text containing `{name}` placeholders.
 * @param {Record<string, unknown>} [params] - Values to substitute.
 * @returns {string} The formatted text.
 */
export function format(template, params) {
  if (params === undefined) return template
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole
  ))
}

/**
 * Build a translator over the shipped dictionaries, for environments with no locale service.
 *
 * Chinese is the default: it is the language the panel was written in, so an environment without the
 * service renders exactly what it rendered before translation existed.
 *
 * @param {'zh'|'en'} locale - Which dictionary to read first.
 * @returns {(key: string, params?: Record<string, unknown>) => string} Translator.
 */
export function createTranslator(locale) {
  const primary = locale === 'en' ? EN : ZH
  return (key, params) => {
    const template = primary[key] ?? ZH[key] ?? key
    return format(template, params)
  }
}

/** The translator currently in use. Chinese by default, until `apply()` wires the real service. */
let translator = createTranslator('zh')

/**
 * Point this module at the DSH locale service.
 *
 * Called once from the plugin's `apply`. The bound function resolves against the service's current
 * snapshot on every call, so a later language switch is picked up without rebinding.
 *
 * @param {{bind: (ns: string) => (key: string, params?: object) => string}} locale - The locale service.
 * @returns {void}
 */
export function setTranslator(locale) {
  const bound = locale.bind(NS)
  translator = (key, params) => {
    const text = bound(key, params)
    // The service answers with the key itself when a namespace has no entry, which would fill the UI
    // with `card.install`. Falling back to the shipped dictionary keeps a partial registration usable.
    if (text === key) return createTranslator('zh')(key, params)
    return text
  }
}

/**
 * Translate one key.
 *
 * Exported as `t` so call sites read `t('card.install')`. Reads `translator` through the module
 * binding, so a `setTranslator` call made after import is honoured.
 *
 * @param {string} key - Dictionary key.
 * @param {Record<string, unknown>} [params] - Placeholder values.
 * @returns {string} Translated text.
 */
export function t(key, params) {
  return translator(key, params)
}

/**
 * Translate a key that may not exist yet, without the fallback chain.
 *
 * Used for upstream category keys, which are a fixed published list: `category.<key>` is looked up
 * and the raw Chinese category name from the API is used when there is no entry, so an upstream
 * category added later still renders something meaningful.
 *
 * @param {string} key - Category key from the API.
 * @param {string} fallback - Name to use when the dictionary has no entry.
 * @returns {string} Translated name.
 */
export function translatedCategory(key, fallback) {
  const dictionaryKey = `category.${key}`
  const translated = t(dictionaryKey)
  return translated === dictionaryKey ? fallback : translated
}
