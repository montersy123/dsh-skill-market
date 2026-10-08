/**
 * dsh-skill-market — Client (browser) half.
 *
 * A lazy `window.__ModuleLoader__` factory: running this file registers the
 * factory only; the body executes when the module is first materialised.
 *
 * The UI is the `DeepSeek-技能市场原型` design (`harness-skill-marketplace.html`)
 * ported into a Harness global panel: the prototype's token table, type scale,
 * spacing rhythm, component states and motion are reproduced verbatim, while its
 * data comes from the SkillHub API through this plugin's same-origin Host proxy
 * (`/skill-market/api/*`) instead of the prototype's placeholder array.
 *
 * Deliberate deviations from the prototype, all of them because the Harness
 * shell already owns the thing the prototype drew:
 *   - no brand sidebar, no window chrome (the shell's own columns are adjacent);
 *   - no fabricated star ratings, reviews or changelogs: SkillHub publishes
 *     score, downloads, stars, tags and versions, so the inspector shows those;
 *   - the prototype's placeholder install flow becomes a local library the user
 *     owns, persisted in this plugin's own data directory (`data/panel.json`, via
 *     the Host half) rather than in the shell's Web Storage.
 *
 * @see https://skillhub.cn/skills?sortBy=score
 */
window.__ModuleLoader__.load({
  // Must equal the package name: the kernel resolves this registration by the
  // package it belongs to, so a mismatch aborts the whole web boot.
  id: '@montersy123/dsh-skill-market',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace and the panel id shared by the sidebar entry and `main`. */
    const NS = '@montersy123/dsh-skill-market'
    const PANEL_ID = 'skill-market'

    /* ── generated locale block — edit lib/locale.js and run scripts/inline-client-locale.mjs ── */
    const CLIENT_NS = "@montersy123/dsh-skill-market"
    const ZH = {
      "action.cancel": "取消",
      "action.confirmInstall": "安装「{name}」",
      "action.detailFailed": "详情加载失败：{reason}",
      "action.disableNamed": "已停用「{name}」",
      "action.disableRestart": "已停用「{name}」，重启 DeepSeek Harness 后生效",
      "action.downgrade": "回退「{name}」到 v{version}？",
      "action.downgradeBody": "当前安装的是 v{current}。技能目录会被替换为该旧版本的完整文件。",
      "action.downgradeConfirm": "回退",
      "action.enableNamed": "已启用「{name}」",
      "action.enableRestart": "已启用「{name}」，重启 DeepSeek Harness 后生效",
      "action.importFailedNamed": "导入「{name}」失败：{reason}",
      "action.install": "安装",
      "action.installFailed": "安装「{name}」失败：{reason}",
      "action.installedDetail": "已安装「{name}」v{version}：{files} 个文件 → {directory}，重启 DeepSeek Harness 后生效",
      "action.installedNamed": "已安装「{name}」",
      "action.installingNamed": "正在安装「{name}」…",
      "action.installingVersion": "正在安装「{name}」v{version}…",
      "action.noInstallResult": "Host 未返回安装结果",
      "action.removeFromDisabled": "已从停用目录移除「{name}」，重启 DeepSeek Harness 后生效",
      "action.removedFromDisabled": "已从停用目录移除「{name}」",
      "action.savedNamed": "已收藏「{name}」",
      "action.toggleFailed": "切换「{name}」失败：{reason}",
      "action.tooLarge": "技能目录过大（{size} MB > {limit} MB）",
      "action.tooManyFiles": "文件数超出上限（{limit}）",
      "action.uninstall": "卸载",
      "action.uninstallBody": "技能目录会从磁盘删除，已停用的技能也会一并移除，卸载后需要重新下载才能恢复。",
      "action.uninstallDetail": "{directory}（{files} 个文件）",
      "action.uninstallDetailNoFiles": "{directory}",
      "action.uninstallFailed": "卸载「{name}」失败：{reason}",
      "action.uninstallNamed": "卸载 {name}",
      "action.uninstalledNamed": "已卸载「{name}」",
      "action.uninstalledRestart": "已卸载「{name}」，重启 DeepSeek Harness 后生效",
      "action.uninstalling": "卸载「{name}」？",
      "action.unsavedNamed": "已取消收藏「{name}」",
      "action.update": "更新",
      "action.updatedNamed": "已更新「{name}」",
      "action.updatedParked": "已更新「{name}」v{version}：{files} 个文件已写入停用目录，技能仍处于停用状态",
      "card.category": "分类",
      "card.categoryLabel": "分类：{name}",
      "card.downloads": "下载量",
      "card.firstSeen": "首次收录",
      "card.from": "来自 {source}，标识 {canonical}",
      "card.identifier": "标识",
      "card.install": "安装",
      "card.installNamed": "安装「{name}」",
      "card.installed": "已安装",
      "card.installing": "安装中…",
      "card.loadMore": "加载更多",
      "card.noDescription": "该技能未提供简介。",
      "card.official": "官方技能",
      "card.rating": "评分折算",
      "card.ratingTitle": "综合评分折算值",
      "card.save": "收藏 {name}",
      "card.saveShort": "收藏",
      "card.saved": "收藏",
      "card.saves": "收藏数",
      "card.score": "综合评分",
      "card.showing": "已显示 {shown} / {total}",
      "card.showingAll": "已显示全部 {total} 个技能",
      "card.source": "来源",
      "card.stars": "收藏数",
      "card.unsave": "取消收藏 {name}",
      "card.unsaveShort": "取消收藏",
      "card.updatedAt": "最近更新",
      "card.version": "版本",
      "card.view": "查看 {name}",
      "category.ai-agent": "AI Agent",
      "category.business-ops": "商业运营",
      "category.content-creation": "内容创作",
      "category.data-analysis": "数据分析",
      "category.design-media": "设计多媒体",
      "category.dev-programming": "开发编程",
      "category.education": "教育学习",
      "category.it-ops-security": "IT 运维与安全",
      "category.knowledge-management": "知识管理",
      "category.life-service": "生活服务",
      "category.office-efficiency": "办公效率",
      "category.professional": "行业专业",
      "discover.all": "全部技能",
      "discover.chipTitle": "{name}：共 {count} 个（不受当前筛选影响）",
      "discover.eyebrow": "DISCOVER",
      "discover.pageOf": "（本页 {shown} 个）",
      "discover.subtitle": "来自 SkillHub 的技能库，默认按下载量排序。安装后即可在任意会话中直接调用。",
      "discover.title": "发现技能",
      "discover.total": "共 {total} 个",
      "drawer.aria": "技能详情",
      "drawer.close": "关闭详情",
      "drawer.installSkill": "安装技能",
      "drawer.savedState": "已收藏",
      "drawer.sourceCommunity": "社区来源",
      "drawer.sourceOfficial": "官方来源",
      "drawer.uninstallInstalled": "已安装 · 卸载",
      "drawer.updatedAt": "更新于 {time}",
      "drawer.versionUnknown": "版本未标注",
      "empty.goDiscover": "去发现技能",
      "empty.noInstalled": "还没有安装技能",
      "empty.noInstalledBody": "到技能市场挑选一个开始吧。",
      "empty.noMatch": "没有匹配的技能",
      "empty.noMatchBody": "换个关键词，或清空分类筛选后再试。",
      "empty.noSaved": "收藏夹是空的",
      "empty.noSavedBody": "在技能卡片上点击书签图标即可收藏。",
      "err.notJson": "技能市场接口返回了非 JSON 内容（HTTP {status}）",
      "err.offline": "连不上技能市场，请检查网络后重试",
      "err.requestFailed": "技能市场接口请求失败（HTTP {status}）",
      "err.uploadFailed": "上传失败（HTTP {status}）",
      "err.upstreamFailed": "技能市场上游请求失败：{reason}",
      "error.catalog": "技能数据加载失败",
      "error.prunedFavorites": "已清理 {count} 个无法解析的旧收藏",
      "error.retry": "重试",
      "files.back": "返回文件列表",
      "files.failed": "文件清单加载失败：{reason}",
      "files.heading": "文件",
      "files.loading": "正在读取文件清单…",
      "files.loadingOne": "正在读取 {path}",
      "files.localHasNone": "本地导入的技能没有 SkillHub 文件清单。",
      "files.manifestVersion": "清单对应 v{version}",
      "files.noSource": "该技能没有 SkillHub 来源",
      "files.nodeSummary": "{files} 个文件 · {size}",
      "files.nodeTitle": "{path} · 点击查看内容",
      "files.none": "SkillHub 未返回该技能的文件清单。",
      "files.readFailed": "无法读取该文件：{reason}",
      "files.sizeAndLines": "{size} · 共 {lines} 行",
      "files.treeHint": " · 点击文件查看内容",
      "files.treeSummary": "{files} 个文件 · {size} · {version} · 点击文件查看内容",
      "files.treeSummaryBase": "{files} 个文件 · {size}",
      "files.treeSummaryNoVersion": "{files} 个文件 · {size} · 点击查看内容",
      "files.truncated": "文件较大，此处已截断显示。",
      "files.unknownSize": "未知大小",
      "import.badgeLocal": "本地导入",
      "import.badgeManual": "手动放置",
      "import.browse": "浏览文件…",
      "import.doneMany": "已导入 {count} 个技能包",
      "import.doneMixed": "已导入 {ok} 个，{failed} 个失败：{reason}",
      "import.doneOne": "已导入「{name}」",
      "import.dropAria": "选择或拖入 .zip 技能包",
      "import.dropNote": "支持的格式只有 .zip 压缩包，文件大小不能超过 50 MB。",
      "import.dropTitle": "把技能包拖到这里，或点击选择",
      "import.empty": "还没有本地技能",
      "import.emptyBody": "把 .zip 技能包拖到上方区域，或点击「浏览文件…」导入。直接复制到技能目录的技能也会出现在这里。",
      "import.eyebrow": "LOCAL",
      "import.failed": "导入失败：{reason}",
      "import.fileFailed": "{name}：{reason}",
      "import.noResult": "Host 未返回导入结果",
      "import.noResultDetail": "Host 未返回导入结果（响应：{body}）",
      "import.pickFile": "导入技能",
      "import.progress": "正在导入 {done}/{total}：{name}…",
      "import.statEnabled": "已启用",
      "import.statFormat": "技能包格式",
      "import.statImported": "已导入",
      "import.subtitle": "导入当前设备上的技能包，仅在本地生效，不会同步到市场或团队工作区。导入后即可在任意会话中调用。",
      "installed.details": "详情",
      "installed.dirPrefix": "skill 目录：",
      "installed.disabled": "已停用",
      "installed.enableNamed": "启用 {name}",
      "installed.enabled": "已启用",
      "installed.eyebrow": "LIBRARY",
      "installed.fileCount": "（{count} 个文件）",
      "installed.fileCountBare": "{count} 个文件",
      "installed.installedAt": "安装于 {time}",
      "installed.noVersion": "版本未标注",
      "installed.pendingBadge": "待生效",
      "installed.pendingBadgeTitle": "本次已修改，重启后对新会话生效",
      "installed.remove": "移除",
      "installed.removeNamed": "移除 {name}",
      "installed.subtitle": "{count} 个技能已加入本地技能库，可随时停用而不卸载。",
      "installed.toggleLabel": "启用 / 停用",
      "installed.version": "版本 {version}",
      "metrics.downloads": "下载量",
      "metrics.heading": "SkillHub 指标",
      "metrics.homepage": "主页",
      "metrics.note": "全部数值直接来自 SkillHub 公开接口。",
      "metrics.rating": "评分折算",
      "metrics.score": "综合评分",
      "metrics.stars": "收藏数",
      "metrics.total": "SkillHub 共 {total}",
      "misc.byAuthor": "作者未填写更新说明",
      "misc.community": "社区",
      "misc.localMachine": "本机",
      "misc.localVersion": "本地 v{version}",
      "misc.machineRecord": "本机记录",
      "misc.notStated": "未标注",
      "misc.official": "官方",
      "misc.unknown": "未知",
      "misc.vendorKeen": "科恩实验室",
      "misc.vendorSanbu": "云鼎实验室",
      "overview.fromCommunity": "来自 SkillHub 社区，标识 {canonical}",
      "overview.fromOfficial": "来自 SkillHub 认证，标识 {canonical}",
      "overview.installedHint": "已安装的技能；打开详情可读取 SkillHub 上的说明。",
      "overview.keyInfo": "关键信息",
      "overview.needsKey": "需要自备 API Key",
      "overview.noKey": "无需额外 API Key",
      "overview.summary": "简介",
      "overview.summaryFailed": "简介加载失败：{reason}",
      "overview.unknownCategory": "未分类",
      "overview.unknownSkill": "未知技能",
      "overview.useCases": "适用场景",
      "overview.version": "当前版本 v{version}",
      "overview.versionMaintained": "版本信息由作者维护",
      "panel.aria": "技能市场视图",
      "panel.title": "技能市场",
      "perm.heading": "需要的权限",
      "perm.localLibrary": "本地技能库",
      "perm.localLibraryDesc": "「安装」只在本机记录该技能并启用；技能文件本身仍由你通过本地导入提供。",
      "perm.metadata": "读取技能元数据",
      "perm.metadataDesc": "本插件仅从 SkillHub 读取公开的名称、简介、版本与统计信息，不写入你的任何数据。",
      "perm.needsKey": "作者标注需要自备 API Key。",
      "perm.network": "网络访问",
      "perm.networkDesc": "技能自身可能访问外部服务；{key}",
      "perm.noKeyNote": "作者未标注需要 API Key。",
      "perm.note": "以下说明区分技能自身的声明与本插件的行为，你可以在设置中随时收回。",
      "restart.bannerTitle": "本次改了 {count} 个技能",
      "restart.dismiss": "知道了",
      "restart.dismissTitle": "只是清掉这个提示，不影响技能状态",
      "restart.effect": "重启 DeepSeek Harness 后生效",
      "risk.high": "高风险",
      "risk.low": "低风险",
      "risk.mid": "中风险",
      "safety.allBenign": "所有检测方均报告安全，无风险",
      "safety.badge": "安全",
      "safety.badgeTitle": "安全扫描通过：所有检测方均报告安全，无风险",
      "safety.failed": "检测结果读取失败：{reason}",
      "safety.hasRisk": "有检测方报告可疑，存在潜在风险",
      "safety.heading": "安全扫描",
      "safety.hiddenNote": "「安全」标记只在全部检测方都报告安全时出现，因此当前不显示该标记。",
      "safety.loading": "正在读取检测结果…",
      "safety.none": "SkillHub 未提供该技能的安全检测结果。",
      "safety.note": "结果由 SkillHub 的第三方检测方给出，与「权限」页说明的本插件行为无关。",
      "safety.pending": "检测仍在排队中",
      "safety.report": "查看报告",
      "safety.shownNote": "卡片与详情页的「安全」标记只在全部检测方都报告安全时出现。",
      "safety.unknown": "检测结果未明",
      "saved.eyebrow": "COLLECTION",
      "saved.subtitle": "{count} 个技能已收藏，仅保存在本机。",
      "saved.upToDate": "已是 SkillHub 上的最新版本",
      "saved.updatable": "可更新",
      "saved.update": "更新",
      "saved.updated": "已更新",
      "saved.versionArrow": "v{local} → v{latest}",
      "search.placeholder": "搜索技能、描述或关键词",
      "search.refresh": "刷新技能数据",
      "search.refreshShort": "刷新",
      "sort.aria": "排序方式",
      "sort.downloads": "按下载量",
      "sort.score": "按综合评分",
      "sort.stars": "按收藏数",
      "sort.updated": "按更新时间",
      "status.connected": "已连接 SkillHub",
      "status.error": "SkillHub 连接异常",
      "status.loading": "加载中…",
      "status.syncing": "正在同步 SkillHub",
      "tab.files": "文件",
      "tab.metrics": "指标",
      "tab.overview": "概览",
      "tab.permissions": "权限",
      "tab.safety": "安全扫描",
      "tab.versions": "版本历史",
      "time.days": "{count} 天前",
      "time.hours": "{count} 小时前",
      "time.justNow": "刚刚",
      "time.minutes": "{count} 分钟前",
      "time.months": "{count} 个月前",
      "time.years": "{count} 年前",
      "toast.undo": "撤销",
      "versions.category": "分类",
      "versions.collapse": "收起历史版本",
      "versions.comparison": "本地 v{local} · SkillHub v{latest}",
      "versions.currentVersion": "当前版本",
      "versions.expand": "展开其余 {count} 个版本",
      "versions.failed": "版本历史加载失败：{reason}",
      "versions.firstSeen": "首次收录",
      "versions.heading": "版本历史",
      "versions.identifier": "标识",
      "versions.installThis": "安装",
      "versions.installed": "已安装",
      "versions.latest": "最新",
      "versions.loading": "正在读取版本历史…",
      "versions.localHasNone": "本地导入的技能没有 SkillHub 版本历史。",
      "versions.newAvailable": "有新版本可用",
      "versions.noChangelog": "作者未填写更新说明",
      "versions.none": "SkillHub 未返回版本记录。",
      "versions.source": "来源",
      "versions.upToDate": "已是 SkillHub 上的最新版本",
      "versions.updateTo": "更新到 v{version}",
      "versions.updatedAt": "最近更新",
      "versions.updatedAtValue": "{date}（{relative}）",
      "versions.versionAndSource": "版本与来源",
      "view.discover": "发现",
      "view.import": "本地导入",
      "view.installed": "已安装",
      "view.saved": "收藏",
    }
    const EN = {
      "action.cancel": "Cancel",
      "action.confirmInstall": "Install “{name}”",
      "action.detailFailed": "Could not load details: {reason}",
      "action.disableNamed": "Disabled “{name}”",
      "action.disableRestart": "Disabled “{name}”. Restart DeepSeek Harness to apply.",
      "action.downgrade": "Roll “{name}” back to v{version}?",
      "action.downgradeBody": "v{current} is currently installed. The skill directory is replaced with that older release in full.",
      "action.downgradeConfirm": "Roll back",
      "action.enableNamed": "Enabled “{name}”",
      "action.enableRestart": "Enabled “{name}”. Restart DeepSeek Harness to apply.",
      "action.importFailedNamed": "Could not import “{name}”: {reason}",
      "action.install": "Install",
      "action.installFailed": "Could not install “{name}”: {reason}",
      "action.installedDetail": "Installed “{name}” v{version}: {files} files → {directory}. Restart DeepSeek Harness to apply.",
      "action.installedNamed": "Installed “{name}”",
      "action.installingNamed": "Installing “{name}”…",
      "action.installingVersion": "Installing “{name}” v{version}…",
      "action.noInstallResult": "The Host did not return an install result",
      "action.removeFromDisabled": "Removed “{name}” from the disabled store. Restart DeepSeek Harness to apply.",
      "action.removedFromDisabled": "Removed “{name}” from the disabled store",
      "action.savedNamed": "Saved “{name}”",
      "action.toggleFailed": "Could not switch “{name}”: {reason}",
      "action.tooLarge": "Skill directory too large ({size} MB > {limit} MB)",
      "action.tooManyFiles": "Too many files (limit {limit})",
      "action.uninstall": "Uninstall",
      "action.uninstallBody": "The skill directory is deleted from disk, including a disabled copy. Reinstalling requires downloading it again.",
      "action.uninstallDetail": "{directory} ({files} files)",
      "action.uninstallDetailNoFiles": "{directory}",
      "action.uninstallFailed": "Could not uninstall “{name}”: {reason}",
      "action.uninstallNamed": "Uninstall {name}",
      "action.uninstalledNamed": "Uninstalled “{name}”",
      "action.uninstalledRestart": "Uninstalled “{name}”. Restart DeepSeek Harness to apply.",
      "action.uninstalling": "Uninstall “{name}”?",
      "action.unsavedNamed": "Removed “{name}” from saved",
      "action.update": "Update",
      "action.updatedNamed": "Updated “{name}”",
      "action.updatedParked": "Updated “{name}” v{version}: {files} files written to the disabled store; the skill stays disabled",
      "card.category": "Category",
      "card.categoryLabel": "Category: {name}",
      "card.downloads": "Downloads",
      "card.firstSeen": "First seen",
      "card.from": "From {source}, identifier {canonical}",
      "card.identifier": "Identifier",
      "card.install": "Install",
      "card.installNamed": "Install “{name}”",
      "card.installed": "Installed",
      "card.installing": "Installing…",
      "card.loadMore": "Load more",
      "card.noDescription": "This skill has no description.",
      "card.official": "Official skill",
      "card.rating": "Rating",
      "card.ratingTitle": "Score converted to a 5-point rating",
      "card.save": "Save {name}",
      "card.saveShort": "Save",
      "card.saved": "Saved",
      "card.saves": "Saves",
      "card.score": "Score",
      "card.showing": "Showing {shown} / {total}",
      "card.showingAll": "All {total} skills shown",
      "card.source": "Source",
      "card.stars": "Saves",
      "card.unsave": "Remove {name} from saved",
      "card.unsaveShort": "Saved",
      "card.updatedAt": "Last updated",
      "card.version": "Version",
      "card.view": "View {name}",
      "category.ai-agent": "AI agent",
      "category.business-ops": "Business operations",
      "category.content-creation": "Content creation",
      "category.data-analysis": "Data analysis",
      "category.design-media": "Design and media",
      "category.dev-programming": "Development",
      "category.education": "Education",
      "category.it-ops-security": "IT operations and security",
      "category.knowledge-management": "Knowledge management",
      "category.life-service": "Everyday services",
      "category.office-efficiency": "Office efficiency",
      "category.professional": "Industry",
      "discover.all": "All skills",
      "discover.chipTitle": "{name}: {count} total (not affected by the current filter)",
      "discover.eyebrow": "DISCOVER",
      "discover.pageOf": " ({shown} on this page)",
      "discover.subtitle": "Skills from SkillHub, most downloaded first. Install one to call it from any conversation.",
      "discover.title": "Discover skills",
      "discover.total": "{total} skills",
      "drawer.aria": "Skill details",
      "drawer.close": "Close details",
      "drawer.installSkill": "Install skill",
      "drawer.savedState": "Saved",
      "drawer.sourceCommunity": "Community source",
      "drawer.sourceOfficial": "Official source",
      "drawer.uninstallInstalled": "Installed · uninstall",
      "drawer.updatedAt": "Updated {time}",
      "drawer.versionUnknown": "Version not stated",
      "empty.goDiscover": "Browse skills",
      "empty.noInstalled": "No skills installed yet",
      "empty.noInstalledBody": "Pick one from the market to get started.",
      "empty.noMatch": "No matching skills",
      "empty.noMatchBody": "Try another keyword, or clear the category filter.",
      "empty.noSaved": "Nothing saved yet",
      "empty.noSavedBody": "Click the bookmark icon on a skill card to save it.",
      "err.notJson": "The skill-market API returned something that is not JSON (HTTP {status})",
      "err.offline": "Could not reach the skill market — check your network and retry",
      "err.requestFailed": "Skill-market API request failed (HTTP {status})",
      "err.uploadFailed": "Upload failed (HTTP {status})",
      "err.upstreamFailed": "SkillHub request failed: {reason}",
      "error.catalog": "Could not load skill data",
      "error.prunedFavorites": "Cleared {count} saved entries that could no longer be resolved",
      "error.retry": "Retry",
      "files.back": "Back to the file list",
      "files.failed": "Could not load the file list: {reason}",
      "files.heading": "Files",
      "files.loading": "Reading the file list…",
      "files.loadingOne": "Reading {path}",
      "files.localHasNone": "A locally imported skill has no SkillHub file list.",
      "files.manifestVersion": "list matches v{version}",
      "files.noSource": "This skill has no SkillHub source",
      "files.nodeSummary": "{files} file(s) · {size}",
      "files.nodeTitle": "{path} · click to read",
      "files.none": "SkillHub returned no file list for this skill.",
      "files.readFailed": "Could not read this file: {reason}",
      "files.sizeAndLines": "{size} · {lines} line(s)",
      "files.treeHint": " · click a file to read it",
      "files.treeSummary": "{files} file(s) · {size} · {version} · click a file to read it",
      "files.treeSummaryBase": "{files} file(s) · {size}",
      "files.treeSummaryNoVersion": "{files} file(s) · {size} · click a file to read it",
      "files.truncated": "This file is large; the preview is truncated.",
      "files.unknownSize": "Unknown size",
      "import.badgeLocal": "Imported",
      "import.badgeManual": "Placed by hand",
      "import.browse": "Browse files…",
      "import.doneMany": "Imported {count} skill packages",
      "import.doneMixed": "Imported {ok}, {failed} failed: {reason}",
      "import.doneOne": "Imported “{name}”",
      "import.dropAria": "Choose or drop a .zip skill package",
      "import.dropNote": "Only .zip archives are supported, up to 50 MB each.",
      "import.dropTitle": "Drop a skill package here, or click to choose",
      "import.empty": "No local skills yet",
      "import.emptyBody": "Drop a .zip package above, or click “Browse files…”. Skills copied straight into the skill directory appear here too.",
      "import.eyebrow": "LOCAL",
      "import.failed": "Import failed: {reason}",
      "import.fileFailed": "{name}: {reason}",
      "import.noResult": "The Host did not return an import result",
      "import.noResultDetail": "The Host did not return an import result (response: {body})",
      "import.pickFile": "Import skill",
      "import.progress": "Importing {done}/{total}: {name}…",
      "import.statEnabled": "Enabled",
      "import.statFormat": "Package format",
      "import.statImported": "Imported",
      "import.subtitle": "Import a skill package from this device. It stays local and is not synced to the market or a team workspace, and can be called from any conversation once imported.",
      "installed.details": "Details",
      "installed.dirPrefix": "skill directory: ",
      "installed.disabled": "Disabled",
      "installed.enableNamed": "Enable {name}",
      "installed.enabled": "Enabled",
      "installed.eyebrow": "LIBRARY",
      "installed.fileCount": " ({count} files)",
      "installed.fileCountBare": "{count} files",
      "installed.installedAt": "installed {time}",
      "installed.noVersion": "Version not stated",
      "installed.pendingBadge": "Pending",
      "installed.pendingBadgeTitle": "Changed this session; takes effect in new conversations after a restart",
      "installed.remove": "Remove",
      "installed.removeNamed": "Remove {name}",
      "installed.subtitle": "{count} skill(s) in your local library. Disable one at any time without uninstalling it.",
      "installed.toggleLabel": "Enable / disable",
      "installed.version": "Version {version}",
      "metrics.downloads": "Downloads",
      "metrics.heading": "SkillHub metrics",
      "metrics.homepage": "Homepage",
      "metrics.note": "All values come directly from SkillHub’s public API.",
      "metrics.rating": "Rating",
      "metrics.score": "Score",
      "metrics.stars": "Saves",
      "metrics.total": "{total} skills on SkillHub",
      "misc.byAuthor": "No release notes from the author",
      "misc.community": "Community",
      "misc.localMachine": "This machine",
      "misc.localVersion": "local v{version}",
      "misc.machineRecord": "Local record",
      "misc.notStated": "not stated",
      "misc.official": "Official",
      "misc.unknown": "Unknown",
      "misc.vendorKeen": "Keen Lab",
      "misc.vendorSanbu": "Yunding Lab",
      "overview.fromCommunity": "From the SkillHub community, identifier {canonical}",
      "overview.fromOfficial": "From SkillHub verified, identifier {canonical}",
      "overview.installedHint": "An installed skill. Open the details to read its description on SkillHub.",
      "overview.keyInfo": "Key facts",
      "overview.needsKey": "You must supply your own API key",
      "overview.noKey": "No extra API key needed",
      "overview.summary": "Summary",
      "overview.summaryFailed": "Could not load the summary: {reason}",
      "overview.unknownCategory": "Uncategorised",
      "overview.unknownSkill": "Unknown skill",
      "overview.useCases": "When to use it",
      "overview.version": "Current version v{version}",
      "overview.versionMaintained": "Version information is maintained by the author",
      "panel.aria": "Skill market view",
      "panel.title": "Skill Market",
      "perm.heading": "Permissions needed",
      "perm.localLibrary": "Local skill library",
      "perm.localLibraryDesc": "“Install” only records and enables the skill on this machine; you still supply the skill files through local import.",
      "perm.metadata": "Reads skill metadata",
      "perm.metadataDesc": "This plugin only reads public names, descriptions, versions and statistics from SkillHub. It writes none of your data.",
      "perm.needsKey": "the author states you must supply an API key.",
      "perm.network": "Network access",
      "perm.networkDesc": "The skill itself may call external services; {key}",
      "perm.noKeyNote": "the author states no API key is needed.",
      "perm.note": "These notes separate what the skill itself declares from what this plugin does. You can revoke them in Settings at any time.",
      "restart.bannerTitle": "{count} skill(s) changed",
      "restart.dismiss": "Got it",
      "restart.dismissTitle": "Dismisses this notice only; skill state is unaffected",
      "restart.effect": "Restart DeepSeek Harness to apply",
      "risk.high": "High risk",
      "risk.low": "Low risk",
      "risk.mid": "Medium risk",
      "safety.allBenign": "Every scanner reports safe, no risk",
      "safety.badge": "Safe",
      "safety.badgeTitle": "Scan passed: every scanner reports safe, no risk",
      "safety.failed": "Could not read scan results: {reason}",
      "safety.hasRisk": "A scanner reports suspicious, potential risk",
      "safety.heading": "Security scan",
      "safety.hiddenNote": "The “Safe” mark appears only when every scanner reports safe, so it is not shown here.",
      "safety.loading": "Reading scan results…",
      "safety.none": "SkillHub provides no security scan for this skill.",
      "safety.note": "Results come from SkillHub’s third-party scanners and are unrelated to this plugin’s own behaviour described under Permissions.",
      "safety.pending": "The scan is still queued",
      "safety.report": "View report",
      "safety.shownNote": "The “Safe” mark on cards and here appears only when every scanner reports safe.",
      "safety.unknown": "Scan result unclear",
      "saved.eyebrow": "COLLECTION",
      "saved.subtitle": "{count} skill(s) saved, on this machine only.",
      "saved.upToDate": "Already the latest version on SkillHub",
      "saved.updatable": "Update available",
      "saved.update": "Update",
      "saved.updated": "Updated",
      "saved.versionArrow": "v{local} → v{latest}",
      "search.placeholder": "Search skills, descriptions or keywords",
      "search.refresh": "Refresh skill data",
      "search.refreshShort": "Refresh",
      "sort.aria": "Sort order",
      "sort.downloads": "Most downloaded",
      "sort.score": "Highest rated",
      "sort.stars": "Most saved",
      "sort.updated": "Recently updated",
      "status.connected": "Connected to SkillHub",
      "status.error": "SkillHub connection problem",
      "status.loading": "Loading…",
      "status.syncing": "Syncing with SkillHub",
      "tab.files": "Files",
      "tab.metrics": "Metrics",
      "tab.overview": "Overview",
      "tab.permissions": "Permissions",
      "tab.safety": "Security",
      "tab.versions": "Version",
      "time.days": "{count} d ago",
      "time.hours": "{count} h ago",
      "time.justNow": "just now",
      "time.minutes": "{count} min ago",
      "time.months": "{count} mo ago",
      "time.years": "{count} y ago",
      "toast.undo": "Undo",
      "versions.category": "Category",
      "versions.collapse": "Hide older versions",
      "versions.comparison": "local v{local} · SkillHub v{latest}",
      "versions.currentVersion": "Current version",
      "versions.expand": "Show the other {count} version(s)",
      "versions.failed": "Could not load version history: {reason}",
      "versions.firstSeen": "First seen",
      "versions.heading": "Version history",
      "versions.identifier": "Identifier",
      "versions.installThis": "Install",
      "versions.installed": "Installed",
      "versions.latest": "Latest",
      "versions.loading": "Reading version history…",
      "versions.localHasNone": "A locally imported skill has no SkillHub version history.",
      "versions.newAvailable": "A newer version is available",
      "versions.noChangelog": "No release notes from the author",
      "versions.none": "SkillHub returned no version records.",
      "versions.source": "Source",
      "versions.upToDate": "Already the latest version on SkillHub",
      "versions.updateTo": "Update to v{version}",
      "versions.updatedAt": "Last updated",
      "versions.updatedAtValue": "{date} ({relative})",
      "versions.versionAndSource": "Version and source",
      "view.discover": "Discover",
      "view.import": "Local import",
      "view.installed": "Installed",
      "view.saved": "Saved",
    }

    /** Installed by apply(); falls back to Chinese so a missing service still renders text. */
    let clientLocale = null

    /**
     * Substitute `{name}` placeholders, leaving unknown ones visible so a slip shows in the UI.
     * @param {string} template - Text with placeholders.
     * @param {object} [params] - Values.
     * @returns {string} Formatted text.
     */
    function formatText(template, params) {
      if (params === undefined) return template
      return String(template).replace(/\{(\w+)\}/g, (whole, key) => (
        Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole
      ))
    }

    /**
     * Translate one key through the active language.
     *
     * Uses the DSH locale service when `apply()` has wired one, and the shipped dictionaries
     * otherwise — a harness, or a build without the client locale package. The service answers with
     * the key itself for an unregistered namespace, which is detected and replaced by the dictionary
     * so a partial registration cannot fill the panel with `card.install`.
     *
     * @param {string} key - Dictionary key.
     * @param {object} [params] - Placeholder values.
     * @returns {string} Translated text.
     */
    function t(key, params) {
      const dictionary = clientActive === 'en' ? EN : ZH
      if (clientLocale !== null) {
        const text = clientLocale(key, params)
        if (text !== key) return text
      }
      return formatText(dictionary[key] ?? ZH[key] ?? key, params)
    }

    /** Which shipped dictionary to prefer when no service is wired. */
    let clientActive = 'zh'

    /**
     * The locale tag to hand to `toLocaleDateString` / `toLocaleString`.
     *
     * Numbers and dates are formatted at the call site, before the value reaches a dictionary, so no
     * entry has to know about grouping or date order. Without it the panel grouped digits as Chinese
     * inside an English UI.
     *
     * @returns {string} A BCP 47 tag.
     */
    function uiLocale() {
      return clientActive === 'en' ? 'en-US' : 'zh-CN'
    }

    /**
     * Translate a category key, falling back to the name upstream sent.
     * @param {string} key - Category key from the API.
     * @param {string} fallback - Upstream display name.
     * @returns {string} Localised name.
     */
    function translatedCategory(key, fallback) {
      const dictionaryKey = `category.${key}`
      const translated = t(dictionaryKey)
      return translated === dictionaryKey ? fallback : translated
    }
    /* ── end generated locale block ────────────────────────────────────── */

    /** Same-origin proxy path owned by this plugin's Host half. */
    const API = 'skill-market/api'
    /**
     * The Host route that owns this panel's persisted state.
     * @see the store section below for what it holds and where the file lives.
     */
    const STATE_PATH = 'state'
    /**
     * The Web Storage keys this panel used before that state became a file.
     *
     * They are read **once**, by the adoption in `hydratePanelState`, and then deleted: the
     * data belongs in this plugin's own data directory, not in the desktop shell's Local
     * Storage, which is DSH's store rather than this plugin's. Keeping the original unscoped
     * spelling matters for exactly that one read — a renamed key would silently drop the
     * favorites and ledger already saved under the old name instead of carrying them over.
     */
    const LEGACY_STATE_KEY = 'dsh-skill-market/v1'
    /** The restart-advice payload's old Web Storage key; adopted and deleted the same way. */
    const LEGACY_PENDING_KEY = 'dsh-skill-market/pending/v1'
    /**
     * How often an open panel asks the Host whether another window changed the document.
     *
     * `localStorage` used to raise a `storage` event, which is how two windows kept in step. A
     * file raises nothing, so the only options are a poll or a lock service, and a panel with no
     * live channel between its instances is not worth a lock service. Ten seconds is slow enough
     * to be invisible in the Host's log and fast enough that a second window is never stale by
     * more than one glance.
     */
    const PANEL_SYNC_INTERVAL_MS = 10_000

    /**
     * Resolve one proxy path against the document's own base.
     *
     * A root-absolute path is wrong wherever the UI is mounted under a prefix: a
     * reverse proxy at `https://host/app/my-dsh/` would send `/skill-market/api`
     * to the host root instead of the mount. `document.baseURI` is the directory
     * the UI was actually served from — the shipped shell injects
     * `<base href="./">` for exactly this reason, and the desktop shell, which
     * serves the page from `dsh-app://app/` and forwards every non-asset path to
     * the Host, resolves the same relative path identically.
     *
     * @param {string} path - Proxy path such as `skills` or `categories`.
     * @returns {string} Path resolved against the document base.
     */
    function apiPath(path) {
      const relative = `${API}/${String(path).replace(/^\/+/, '')}`
      if (typeof document === 'undefined') return `/${relative}`
      return new URL(relative, document.baseURI).pathname
    }
    /** Fallback category list; replaced by `/api/v1/categories` when it answers. */
    /**
     * Categories the panel never offers.
     *
     * `pay-skill` is upstream's commercial tier rather than a topic, and it is not
     * wanted in this panel's filters. The vocabulary arrives from the API and its
     * `active` flag does not exclude it, so it is filtered out here — including from
     * the fallback list, so it never appears even before the API answers.
     */
    const HIDDEN_CATEGORIES = new Set(['pay-skill'])
    const FALLBACK_CATEGORIES = [
      { key: 'office-efficiency', name: 'category.office-efficiency' },
      { key: 'content-creation', name: 'category.content-creation' },
      { key: 'dev-programming', name: 'category.dev-programming' },
      { key: 'data-analysis', name: 'category.data-analysis' },
      { key: 'design-media', name: 'category.design-media' },
      { key: 'ai-agent', name: 'AI Agent' },
      { key: 'knowledge-management', name: 'category.knowledge-management' },
      { key: 'business-ops', name: 'category.business-ops' },
      { key: 'education', name: 'category.education' },
      { key: 'professional', name: 'category.professional' },
      { key: 'it-ops-security', name: 'category.it-ops-security' },
      { key: 'life-service', name: 'category.life-service' },
    ]
    /** Sort options: the API's `sortBy` values with the prototype's labels. */
    const SORTS = [
      { value: 'downloads', label: 'sort.downloads' },
      { value: 'score', label: 'sort.score' },
      { value: 'stars', label: 'sort.stars' },
      { value: 'updated_at', label: 'sort.updated' },
    ]
    /**
     * The order 发现 opens in.
     *
     * Most-downloaded first, and listed first in the control so the select shows what the list is
     * doing. `score` is the site's own default (`skillhub.cn/skills?sortBy=score`), but a marketplace
     * is better introduced by what people actually installed.
     */
    const DEFAULT_SORT = 'downloads'
    /** Icon glyph per upstream category. */
    const CATEGORY_ICON = {
      'dev-programming': 'i-terminal',
      'data-analysis': 'i-table',
      'content-creation': 'i-type',
      'office-efficiency': 'i-clipboard',
      'design-media': 'i-image',
      'ai-agent': 'i-sparkle',
      'knowledge-management': 'i-book',
      'business-ops': 'i-network',
      education: 'i-book',
      professional: 'i-shield',
      'it-ops-security': 'i-lock',
      'life-service': 'i-mail',
      'pay-skill': 'i-database',
    }
    /** Accent hue per category, used for the card glyph plate. */
    const CATEGORY_HUE = {
      'dev-programming': 258,
      'data-analysis': 200,
      'content-creation': 318,
      'office-efficiency': 232,
      'design-media': 12,
      'ai-agent': 282,
      'knowledge-management': 158,
      'business-ops': 42,
      education: 192,
      professional: 88,
      'it-ops-security': 224,
      'life-service': 336,
      'pay-skill': 268,
    }
    /** Risk copy for the permissions a SkillHub skill advertises. */
    const RISK_LABELS = { low: 'risk.low', mid: 'risk.mid', high: 'risk.high' }

    /* ── stylesheet ──────────────────────────────────────────────────────
     * Token names mirror the prototype's `:root` table so the two files can be
     * diffed one-to-one. Values are the exported oklch numbers for the light
     * palette, with a dark palette derived alongside them. Host theme tokens are
     * referenced for the shell-adjacent surfaces (clearance, panel background)
     * so the panel never fights the frame it lives in.
     */
    const CSS = `
[data-skill-market] {
  /* canvas + surface */
  --sm-bg: var(--dsw-alias-bg-base, oklch(99% 0.002 240));
  --sm-surface: var(--dsw-alias-bg-layer-1, oklch(100% 0 0));
  --sm-fg: var(--dsw-alias-label-primary, oklch(18% 0.012 250));
  --sm-muted: var(--dsw-alias-label-secondary, oklch(54% 0.012 250));
  --sm-border: var(--dsw-alias-border-l1, oklch(92% 0.005 250));
  --sm-border-strong: var(--dsw-alias-border-l2, color-mix(in oklch, var(--sm-fg) 22%, var(--sm-border)));
  --sm-accent: var(--dsw-alias-brand-primary, oklch(58% 0.18 255));

  --sm-ok: var(--dsw-alias-state-success-primary, oklch(52% 0.13 155));
  --sm-warn: var(--dsw-alias-state-warn-primary, oklch(52% 0.13 62));
  --sm-danger: var(--dsw-alias-state-error-primary, oklch(52% 0.17 27));
  --sm-star: oklch(62% 0.13 72);

  --sm-accent-soft: color-mix(in oklch, var(--sm-accent) 12%, transparent);
  --sm-accent-line: color-mix(in oklch, var(--sm-accent) 34%, var(--sm-border));
  --sm-fg-soft: color-mix(in oklch, var(--sm-fg) 6%, transparent);
  --sm-fg-softer: color-mix(in oklch, var(--sm-fg) 3.5%, transparent);
  --sm-ok-soft: color-mix(in oklch, var(--sm-ok) 14%, transparent);
  --sm-warn-soft: color-mix(in oklch, var(--sm-warn) 14%, transparent);
  --sm-warn-line: color-mix(in oklch, var(--sm-warn) 32%, var(--sm-border));
  --sm-danger-soft: color-mix(in oklch, var(--sm-danger) 14%, transparent);
  --sm-scrim: color-mix(in oklch, var(--sm-fg) 22%, transparent);
  --sm-shadow-sm: 0 1px 2px color-mix(in oklch, var(--sm-fg) 8%, transparent);
  --sm-shadow-md: 0 12px 32px color-mix(in oklch, var(--sm-fg) 14%, transparent);

  --sm-radius: 9px;
  --sm-radius-lg: 13px;
  --sm-topbar: 58px;
  --sm-statusbar: 28px;

  --sm-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --sm-font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace;
}
body[data-ds-dark-theme] [data-skill-market] {
  --sm-star: oklch(76% 0.13 78);
  --sm-accent-soft: color-mix(in oklch, var(--sm-accent) 20%, transparent);
  --sm-accent-line: color-mix(in oklch, var(--sm-accent) 42%, var(--sm-border));
  --sm-fg-soft: color-mix(in oklch, var(--sm-fg) 10%, transparent);
  --sm-fg-softer: color-mix(in oklch, var(--sm-fg) 5%, transparent);
  --sm-scrim: color-mix(in oklch, black 46%, transparent);
  --sm-shadow-sm: 0 1px 2px color-mix(in oklch, black 40%, transparent);
  --sm-shadow-md: 0 12px 32px color-mix(in oklch, black 52%, transparent);
}

[data-skill-market] *, [data-skill-market] *::before, [data-skill-market] *::after { box-sizing: border-box; }
[data-skill-market] {
  display: flex; flex-direction: column; min-width: 0; min-height: 0;
  /* height: 100% needs a parent with a definite height; when the mount is itself content-sized that
     resolves to auto and the panel grows past the viewport, so the page scrolls instead of only the card
     list. max-height: 100% and the overflow: hidden below keep the panel bounded either way, which is
     what confines scrolling to .sm-content. */
  height: 100%; max-height: 100%; position: relative; overflow: hidden;
  background: var(--sm-bg); color: var(--sm-fg);
  font-family: var(--sm-font); font-size: 14px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
/* The macOS frame overlays the window-chrome strip on every main panel; pad the
   first row into the frame's declared clearance, exactly like the shell's own
   entry pages do. */
[data-platform='darwin'] [data-skill-market] .sm-topbar {
  height: calc(var(--sm-topbar) + var(--dsh-frame-top-clearance, 0px));
  padding-top: var(--dsh-frame-top-clearance, 0px);
}
[data-skill-market] h1, [data-skill-market] h2, [data-skill-market] h3, [data-skill-market] h4 {
  margin: 0; font-weight: 600; letter-spacing: -0.018em;
}
[data-skill-market] p { margin: 0; }
[data-skill-market] button { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }
[data-skill-market] input, [data-skill-market] select { font: inherit; color: inherit; }
[data-skill-market] ::selection { background: var(--sm-accent-soft); }
[data-skill-market] :focus-visible { outline: 2px solid var(--sm-accent); outline-offset: 2px; border-radius: 6px; }
[data-skill-market] .sm-num { font-family: var(--sm-font-mono); font-variant-numeric: tabular-nums; }
[data-skill-market] .sm-meta { font-family: var(--sm-font-mono); font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-eyebrow {
  font-family: var(--sm-font-mono); font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--sm-muted);
}
[data-skill-market] svg { display: block; }
[data-skill-market] .sm-ic { width: 17px; height: 17px; flex: 0 0 auto; }

/* ── topbar ────────────────────────────────────────────────────────── */
[data-skill-market] .sm-topbar {
  height: var(--sm-topbar); flex: 0 0 auto;
  display: flex; align-items: center; gap: 14px; padding: 0 20px;
  border-bottom: 1px solid var(--sm-border);
  background: color-mix(in oklch, var(--sm-bg) 88%, transparent);
  backdrop-filter: blur(12px);
}
[data-skill-market] .sm-search { position: relative; flex: 1; max-width: 520px; display: flex; align-items: center; }
/* In the market head it is a block of its own rather than a flex child of the topbar, so it
   needs an explicit width and the spacing that separates it from the chips below. */
[data-skill-market] .sm-search-row { flex: none; max-width: none; width: 100%; margin: 0 0 14px; }
[data-skill-market] .sm-search-row input { height: 42px; }
[data-skill-market] .sm-search > svg { position: absolute; left: 12px; width: 16px; height: 16px; color: var(--sm-muted); pointer-events: none; }
[data-skill-market] .sm-search input {
  width: 100%; height: 38px; padding: 0 14px 0 36px;
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius);
  background: var(--sm-surface); color: var(--sm-fg); font-size: 13.5px;
  transition: border-color .13s ease, box-shadow .13s ease;
}
[data-skill-market] .sm-search input::placeholder { color: var(--sm-muted); }
[data-skill-market] .sm-search input:focus { outline: none; border-color: var(--sm-accent-line); box-shadow: 0 0 0 3px var(--sm-accent-soft); }
[data-skill-market] .sm-topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }

[data-skill-market] .sm-icon-btn {
  width: 34px; height: 34px; border-radius: var(--sm-radius);
  display: grid; place-items: center; color: var(--sm-muted); position: relative;
  transition: background .13s ease, color .13s ease;
}
[data-skill-market] .sm-icon-btn svg { width: 18px; height: 18px; }
[data-skill-market] .sm-icon-btn:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-icon-btn .sm-dot {
  position: absolute; top: 7px; right: 8px; width: 6px; height: 6px; border-radius: 50%;
  background: var(--sm-accent); border: 1.5px solid var(--sm-bg);
}

/* ── buttons ───────────────────────────────────────────────────────── */
[data-skill-market] .sm-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 14px; border-radius: var(--sm-radius);
  border: 1px solid transparent; font-size: 13px; font-weight: 500;
  letter-spacing: -0.005em; white-space: nowrap;
  transition: background .14s ease, border-color .14s ease, color .14s ease;
}
[data-skill-market] .sm-btn svg { width: 16px; height: 16px; }
[data-skill-market] .sm-btn:active { transform: translateY(1px); }
[data-skill-market] .sm-btn-primary { background: var(--sm-accent); color: var(--sm-surface); border-color: var(--sm-accent); }
[data-skill-market] .sm-btn-primary:hover { background: color-mix(in oklch, var(--sm-accent) 87%, black); }
[data-skill-market] .sm-btn-secondary { background: var(--sm-surface); color: var(--sm-fg); border-color: var(--sm-border); }
[data-skill-market] .sm-btn-secondary:hover { border-color: var(--sm-border-strong); }
[data-skill-market] .sm-btn-ghost { background: transparent; color: var(--sm-muted); padding-inline: 9px; }
[data-skill-market] .sm-btn-ghost:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-btn-sm { height: 30px; padding: 0 11px; font-size: 12.5px; }
[data-skill-market] .sm-btn[disabled] { opacity: .5; cursor: not-allowed; }

/* ── view tabs ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-viewbar {
  flex: 0 0 auto; display: flex; align-items: center;
  padding: 0 20px; border-bottom: 1px solid var(--sm-border); background: var(--sm-bg);
  overflow-x: auto; scrollbar-width: none;
}
[data-skill-market] .sm-viewbar::-webkit-scrollbar { display: none; }
[data-skill-market] .sm-viewtabs { display: flex; gap: 4px; }
[data-skill-market] .sm-viewtab {
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
  padding: 12px 4px; margin: 0 18px -1px 0;
  font-size: 13.5px; font-weight: 500; color: var(--sm-muted);
  border-bottom: 2px solid transparent;
  transition: color .13s ease, border-color .13s ease;
}
[data-skill-market] .sm-viewtab:hover { color: var(--sm-fg); }
[data-skill-market] .sm-viewtab.active { color: var(--sm-fg); border-bottom-color: var(--sm-fg); }
[data-skill-market] .sm-vt-count {
  font-family: var(--sm-font-mono); font-size: 11px; line-height: 1;
  padding: 3px 7px; border-radius: 999px; background: var(--sm-fg-soft); color: var(--sm-muted);
}
[data-skill-market] .sm-viewtab.active .sm-vt-count { color: var(--sm-fg); }

/* ── fixed head + scrolling list ───────────────────────────────────── */
/* Only the card list scrolls: the topbar, view tabs, page head and category
   chips stay put, so the sort control and the filters are reachable at any
   scroll depth. The shared measure runs wide (1760px) so a large window really
   does get more columns — see the responsive block at the end of this sheet. */
[data-skill-market] .sm-bounded { max-width: 1760px; margin: 0 auto; }
[data-skill-market] .sm-fixed {
  flex: 0 0 auto; padding: 18px 24px 0; border-bottom: 1px solid var(--sm-border);
  background: var(--sm-bg);
}
[data-skill-market] .sm-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
[data-skill-market] .sm-inner { padding: 20px 24px 60px; }
[data-skill-market] .sm-statusbar {
  height: var(--sm-statusbar); flex: 0 0 auto; display: flex; align-items: center; gap: 16px;
  padding: 0 20px; border-top: 1px solid var(--sm-border);
  font-family: var(--sm-font-mono); font-size: 11px; color: var(--sm-muted); background: var(--sm-bg);
  overflow: hidden; white-space: nowrap;
}
[data-skill-market] .sm-statusbar .sm-live { display: inline-flex; align-items: center; gap: 6px; color: var(--sm-ok); }
[data-skill-market] .sm-statusbar .sm-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--sm-ok); }
[data-skill-market] .sm-statusbar .sm-live.is-error { color: var(--sm-warn); }
[data-skill-market] .sm-statusbar .sm-live.is-error::before { background: var(--sm-warn); }
[data-skill-market] .sm-statusbar .sm-live.is-idle { color: var(--sm-muted); }
[data-skill-market] .sm-statusbar .sm-live.is-idle::before { background: var(--sm-muted); }
[data-skill-market] .sm-statusbar .sm-spacer { margin-left: auto; }

/* ── page head ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-page-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 24px; flex-wrap: wrap; margin-bottom: 14px;
}
[data-skill-market] .sm-page-title { font-size: 26px; letter-spacing: -0.025em; }
[data-skill-market] .sm-page-sub { color: var(--sm-muted); font-size: 13.5px; margin-top: 5px; max-width: 62ch; }
[data-skill-market] .sm-page-actions { display: flex; align-items: center; gap: 10px; }

[data-skill-market] .sm-select-wrap { position: relative; display: inline-flex; align-items: center; }
[data-skill-market] .sm-select-wrap::after {
  content: '▾'; position: absolute; right: 11px; pointer-events: none; font-size: 10px; color: var(--sm-muted);
}
[data-skill-market] .sm-select-wrap select {
  appearance: none; -webkit-appearance: none; height: 34px; padding: 0 30px 0 12px;
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius);
  background: var(--sm-surface); font-size: 13px;
}
[data-skill-market] .sm-select-wrap select:hover { border-color: var(--sm-border-strong); }

/* ── chips ─────────────────────────────────────────────────────────── */
[data-skill-market] .sm-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
[data-skill-market] .sm-chip {
  height: 30px; padding: 0 13px; border-radius: 999px;
  border: 1px solid var(--sm-border); background: var(--sm-surface);
  color: var(--sm-muted); font-size: 12.5px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 7px;
  transition: border-color .13s ease, color .13s ease, background .13s ease;
}
[data-skill-market] .sm-chip:hover { border-color: var(--sm-border-strong); color: var(--sm-fg); }
[data-skill-market] .sm-chip.active { background: var(--sm-fg); border-color: var(--sm-fg); color: var(--sm-surface); }
[data-skill-market] .sm-chip .sm-chip-n { font-family: var(--sm-font-mono); font-size: 11px; opacity: .72; }

/* ── sections ──────────────────────────────────────────────────────── */
[data-skill-market] .sm-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
[data-skill-market] .sm-section-head h2 { font-size: 15px; letter-spacing: -0.01em; }
[data-skill-market] .sm-section-head .sm-meta { font-weight: 400; }

/* ── skill cards ───────────────────────────────────────────────────── */
/* auto-fit + a fixed 280px floor fills every row instead of leaving a gap at the
   end. A fixed floor beats a vw preference here — a percentage floor grows with
   the viewport and ends up *reducing* the column count on a wide screen, and a
   floor above 280px starts taking columns away from a 1920px window.
   Measured column counts (tools/grid-columns.mjs):
     360-430px -> 1, 600 -> 1, 820 -> 2, 1024 -> 3, 1366 -> 4, 1440 -> 4, 1920 -> 6
   min(100%, ...) keeps one column from overflowing in a very narrow panel. */
[data-skill-market] .sm-grid-cards {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}
[data-skill-market] .sm-card {
  position: relative; display: flex; flex-direction: column; text-align: left;
  background: var(--sm-surface); border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg); padding: 16px;
  transition: border-color .14s ease, box-shadow .14s ease, transform .14s ease;
}
[data-skill-market] .sm-card:hover { border-color: var(--sm-border-strong); box-shadow: var(--sm-shadow-sm); transform: translateY(-1px); }
[data-skill-market] .sm-card.is-open { border-color: var(--sm-accent-line); box-shadow: 0 0 0 3px var(--sm-accent-soft); }
[data-skill-market] .sm-skill-card { cursor: pointer; min-height: 180px; }
[data-skill-market] .sm-skill-icon {
  width: 40px; height: 40px; flex: 0 0 auto; border-radius: 11px; overflow: hidden;
  border: 1px solid var(--sm-border); background: var(--sm-bg);
  display: grid; place-items: center; color: var(--sm-fg);
}
[data-skill-market] .sm-skill-icon svg { width: 20px; height: 20px; }
[data-skill-market] .sm-skill-icon img { width: 100%; height: 100%; object-fit: cover; }
[data-skill-market] .sm-skill-icon.lg { width: 52px; height: 52px; border-radius: 14px; }
[data-skill-market] .sm-skill-icon.lg svg { width: 26px; height: 26px; }
[data-skill-market] .sm-skill-icon.is-tinted { border-color: transparent; }
/* The card header row: icon, then the name/publisher block. This rule was missing entirely, so the
   header had no layout of its own and its children stacked as blocks — while the title rule below
   declared flex: 1, which is inert inside a non-flex parent. The card never got the row it was
   written for. */
[data-skill-market] .sm-card-top { display: flex; align-items: flex-start; gap: 10px; }
[data-skill-market] .sm-card-title { min-width: 0; flex: 1; }
[data-skill-market] .sm-name-row { display: flex; align-items: center; gap: 5px; }
[data-skill-market] .sm-skill-name {
  font-size: 14.5px; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-verified { color: var(--sm-accent); flex: 0 0 auto; }
[data-skill-market] .sm-verified svg { width: 14px; height: 14px; }
/* Safety scan verdict. Green because that is what it means, and only ever drawn when every vendor
   reported benign — see SafetyBadge. */
[data-skill-market] .sm-safety {
  display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto;
  font-size: 11.5px; font-weight: 600; color: var(--sm-ok);
}
[data-skill-market] .sm-safety svg { width: 14px; height: 14px; }
[data-skill-market] .sm-safety-compact svg { width: 13px; height: 13px; }
/* One row per scanning vendor: mark, name, that vendor's own verdict, and its report link pushed to
   the right edge. The row is the unit because the vendors are independent — one can pass while another
   does not, and that disagreement is the thing worth seeing. */
[data-skill-market] .sm-safety-vendors { display: flex; flex-direction: column; gap: 2px; }
[data-skill-market] .sm-safety-vendor {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  font-size: 13px; line-height: 1.5; border-radius: 9px;
  transition: background .13s ease;
}
[data-skill-market] .sm-safety-vendor:hover { background: var(--sm-bg); }
[data-skill-market] .sm-safety-mark { display: inline-flex; flex: 0 0 auto; color: var(--sm-ok); }
[data-skill-market] .sm-safety-mark svg { width: 15px; height: 15px; }
/* Any verdict other than benign: the mark keeps the neutral colour rather than turning red or amber.
   The panel states what the vendor said; it does not grade a scan it cannot interpret. */
[data-skill-market] .sm-safety-vendor.plain .sm-safety-mark { color: var(--sm-muted); }
[data-skill-market] .sm-safety-label { flex: 1; min-width: 0; }
[data-skill-market] .sm-safety-label strong { font-weight: 600; margin-right: 6px; }
[data-skill-market] .sm-safety-report {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--sm-muted);
}
[data-skill-market] .sm-safety-report:hover { color: var(--sm-fg); }
[data-skill-market] .sm-publisher {
  font-size: 12px; color: var(--sm-muted); display: block; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-save-btn {
  width: 28px; height: 28px; border-radius: 7px; flex: 0 0 auto;
  display: grid; place-items: center; color: var(--sm-muted);
  transition: background .13s ease, color .13s ease;
}
/* On a catalog card the bookmark sits in the card's top-right corner rather than in the header row:
   it is a per-card action, and inline it competed with the skill's name for width. The card article
   is already positioned, so this needs no wrapper. */
[data-skill-market] .sm-card > .sm-save-btn { position: absolute; top: 12px; right: 12px; z-index: 2; margin: 0; }
/* Keeps a long name from running under the pinned button. */
[data-skill-market] .sm-skill-card .sm-card-title { padding-right: 34px; }
[data-skill-market] .sm-save-btn svg { width: 16px; height: 16px; }
[data-skill-market] .sm-save-btn:hover { background: var(--sm-fg-soft); color: var(--sm-fg); }
[data-skill-market] .sm-save-btn.saved { color: var(--sm-fg); }
[data-skill-market] .sm-save-btn.saved svg { fill: currentColor; }
[data-skill-market] .sm-card-desc {
  color: var(--sm-muted); font-size: 13px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
[data-skill-market] .sm-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 11px; }
[data-skill-market] .sm-tag {
  font-size: 11px; color: var(--sm-muted);
  border: 1px solid var(--sm-border); border-radius: 999px; padding: 2px 8px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
[data-skill-market] .sm-card-foot { display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 14px; }
[data-skill-market] .sm-stats { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-stats .sm-sep { opacity: .5; }
/* Figures are icon + number and must never wrap: the row sits at the bottom of a card whose height should not
   depend on the language. */
[data-skill-market] .sm-stats > * { flex: 0 0 auto; white-space: nowrap; }
[data-skill-market] .sm-stats .sm-stat { display: inline-flex; align-items: center; gap: 3px; }
[data-skill-market] .sm-stats .sm-stat svg { width: 13px; height: 13px; opacity: .75; }
[data-skill-market] .sm-stats .sm-rating { display: inline-flex; align-items: center; gap: 3px; color: var(--sm-fg); }
[data-skill-market] .sm-stats .sm-rating svg { width: 13px; height: 13px; color: var(--sm-star); }
[data-skill-market] .sm-install-btn {
  margin-left: auto; height: 31px; padding: 0 15px; border-radius: var(--sm-radius);
  border: 1px solid var(--sm-border); background: var(--sm-surface); color: var(--sm-fg);
  font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;
  transition: background .14s ease, border-color .14s ease, color .14s ease;
}
[data-skill-market] .sm-install-btn svg { width: 15px; height: 15px; }
[data-skill-market] .sm-install-btn:hover { border-color: var(--sm-accent); color: var(--sm-accent); background: var(--sm-accent-soft); }
[data-skill-market] .sm-install-btn.installed { color: var(--sm-muted); border-color: var(--sm-border); background: var(--sm-fg-softer); }
[data-skill-market] .sm-install-btn.installed:hover { color: var(--sm-fg); border-color: var(--sm-border-strong); background: var(--sm-fg-soft); }
/* An installed-but-behind card reads as actionable, not as done. */
[data-skill-market] .sm-install-btn.is-update {
  background: var(--sm-accent); color: var(--sm-surface); border-color: var(--sm-accent);
}
[data-skill-market] .sm-install-btn.is-update:hover {
  background: color-mix(in oklch, var(--sm-accent) 88%, var(--sm-fg));
  border-color: color-mix(in oklch, var(--sm-accent) 88%, var(--sm-fg));
  color: var(--sm-surface);
}
[data-skill-market] .sm-install-btn.is-busy { color: var(--sm-muted); cursor: progress; }
[data-skill-market] .sm-install-btn[disabled] { opacity: .6; cursor: progress; }
/* A failed install keeps its reason on the card: the Host's own text (network,
   size ceiling, missing SKILL.md, checksum mismatch) is more useful than a
   generic failure label. */
[data-skill-market] .sm-install-error {
  margin-top: 8px; font-size: 12px; line-height: 1.45; color: var(--sm-danger);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  overflow-wrap: anywhere;
}
[data-skill-market] .sm-link-out { display: inline-flex; align-items: center; gap: 4px; }
[data-skill-market] .sm-link-out svg { width: 13px; height: 13px; }

/* ── restart advice banner ─────────────────────────────────────────── */
/* Advice, not a gate: the panel never blocks a change and never nags beyond
   this banner, which the user can dismiss with 知道了. It exists because the
   page cannot restart the process — on the desktop the Host is a child of the
   Electron shell — so the honest move is to name the step, not to fake it. */
[data-skill-market] .sm-restart-banner {
  display: flex; align-items: flex-start; gap: 14px;
  border: 1px solid var(--sm-accent-line);
  background: color-mix(in oklch, var(--sm-accent) 7%, var(--sm-surface));
  border-radius: var(--sm-radius-lg); padding: 14px 16px; margin-bottom: 20px;
}
[data-skill-market] .sm-rb-ic {
  width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px;
  display: grid; place-items: center; color: var(--sm-accent); background: var(--sm-accent-soft);
}
[data-skill-market] .sm-rb-ic svg { width: 18px; height: 18px; }
[data-skill-market] .sm-rb-text { flex: 1; min-width: 0; }
[data-skill-market] .sm-rb-text strong { font-size: 13.5px; font-weight: 600; }
[data-skill-market] .sm-rb-text p { font-size: 12.5px; color: var(--sm-muted); margin-top: 4px; line-height: 1.55; }
[data-skill-market] .sm-rb-actions { display: flex; flex-direction: column; gap: 6px; flex: 0 0 auto; }

[data-skill-market] .sm-loadmore {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: center;
  gap: 14px; padding: 22px 0 4px; flex-wrap: wrap;
}

/* ── list rows ─────────────────────────────────────────────────────── */
[data-skill-market] .sm-list { border-top: 1px solid var(--sm-border); }
[data-skill-market] .sm-list-row {
  display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 14px; align-items: center;
  padding: 14px 4px; border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-row-main { min-width: 0; }
[data-skill-market] .sm-list-row .sm-name-row { gap: 7px; }
[data-skill-market] .sm-list-row h3 {
  font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-skill-market] .sm-row-sub {
  font-size: 12px; color: var(--sm-muted); margin-top: 3px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
[data-skill-market] .sm-row-sub .sm-sep { opacity: .5; }
/* Figures in a row's sub-line are icon + number, matching the card stats row: an icon needs no translation and
   cannot wrap onto a second line the way "2.4M downloads" did in English. */
[data-skill-market] .sm-row-sub .sm-stat { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
[data-skill-market] .sm-row-sub .sm-stat svg { width: 12px; height: 12px; opacity: .75; }
[data-skill-market] .sm-row-actions { display: flex; align-items: center; gap: 10px; }
[data-skill-market] .sm-badge {
  font-family: var(--sm-font-mono); font-size: 10.5px; letter-spacing: 0.03em;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
}
[data-skill-market] .sm-badge.update { color: var(--sm-warn); background: var(--sm-warn-soft); }
[data-skill-market] .sm-badge.ok { color: var(--sm-ok); background: var(--sm-ok-soft); }
[data-skill-market] .sm-badge.plain { color: var(--sm-muted); background: var(--sm-fg-soft); }
[data-skill-market] .sm-src-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--sm-font-mono); font-size: 10.5px; letter-spacing: 0.03em;
  color: var(--sm-muted); background: var(--sm-fg-soft); border-radius: 999px; padding: 2px 8px;
}
[data-skill-market] .sm-src-badge svg { width: 11px; height: 11px; }

[data-skill-market] .sm-switch { position: relative; width: 38px; height: 22px; flex: 0 0 auto; display: inline-block; }
[data-skill-market] .sm-switch input {
  position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer;
}
[data-skill-market] .sm-switch .sm-track {
  position: absolute; inset: 0; border-radius: 999px; background: var(--sm-border); transition: background .16s ease;
}
[data-skill-market] .sm-switch .sm-thumb {
  position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--sm-surface); box-shadow: var(--sm-shadow-sm); transition: transform .16s ease;
}
[data-skill-market] .sm-switch input:checked + .sm-track { background: var(--sm-ok); }
[data-skill-market] .sm-switch input:checked ~ .sm-thumb { transform: translateX(16px); }
[data-skill-market] .sm-switch input:focus-visible + .sm-track { outline: 2px solid var(--sm-accent); outline-offset: 2px; }

/* ── empty + skeleton ──────────────────────────────────────────────── */
[data-skill-market] .sm-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 64px 20px; gap: 6px;
}
[data-skill-market] .sm-empty .sm-empty-mark {
  width: 46px; height: 46px; border-radius: 13px; border: 1px solid var(--sm-border);
  display: grid; place-items: center; color: var(--sm-muted); margin-bottom: 8px;
}
[data-skill-market] .sm-empty .sm-empty-mark svg { width: 22px; height: 22px; }
[data-skill-market] .sm-empty h3 { font-size: 15px; }
[data-skill-market] .sm-empty p { color: var(--sm-muted); font-size: 13px; max-width: 42ch; }
[data-skill-market] .sm-empty .sm-empty-actions { margin-top: 12px; display: flex; gap: 10px; }
[data-skill-market] .sm-empty.is-error .sm-empty-mark { color: var(--sm-warn); border-color: var(--sm-warn-line); }

[data-skill-market] .sm-skeleton {
  border: 1px solid var(--sm-border); border-radius: var(--sm-radius-lg);
  background: var(--sm-surface); padding: 16px; min-height: 180px;
  display: flex; flex-direction: column; gap: 12px;
}
[data-skill-market] .sm-sk-line {
  height: 11px; border-radius: 999px; background: var(--sm-fg-soft);
  animation: sm-pulse 1.5s ease-in-out infinite;
}
[data-skill-market] .sm-sk-head { display: flex; gap: 11px; }
[data-skill-market] .sm-sk-plate { width: 40px; height: 40px; border-radius: 11px; background: var(--sm-fg-soft); animation: sm-pulse 1.5s ease-in-out infinite; }
[data-skill-market] .sm-sk-head .sm-sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
@keyframes sm-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }

/* ── stat cards ────────────────────────────────────────────────────── */
[data-skill-market] .sm-stat-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px; }
[data-skill-market] .sm-stat-card { background: var(--sm-surface); border: 1px solid var(--sm-border); border-radius: var(--sm-radius-lg); padding: 16px; }
[data-skill-market] .sm-stat-card .sm-k { font-size: 12px; color: var(--sm-muted); }
[data-skill-market] .sm-stat-card .sm-v {
  font-family: var(--sm-font-mono); font-size: 26px; font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em; margin-top: 6px;
}

/* ── local import dropzone ─────────────────────────────────────────── */
[data-skill-market] .sm-dropzone {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 5px; padding: 38px 24px; margin-bottom: 30px;
  border: 1.5px dashed color-mix(in oklch, var(--sm-fg) 24%, var(--sm-border));
  border-radius: var(--sm-radius-lg); background: var(--sm-surface);
  cursor: pointer; transition: border-color .15s ease, background .15s ease;
}
[data-skill-market] .sm-dropzone:hover { border-color: var(--sm-accent-line); }
[data-skill-market] .sm-dropzone.dragover { border-color: var(--sm-accent); background: var(--sm-accent-soft); }
[data-skill-market] .sm-dropzone .sm-dz-ic {
  width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center;
  color: var(--sm-accent); background: var(--sm-accent-soft); margin-bottom: 7px;
}
[data-skill-market] .sm-dropzone .sm-dz-ic svg { width: 22px; height: 22px; }
[data-skill-market] .sm-dropzone h3 { font-size: 15.5px; }
[data-skill-market] .sm-dropzone p { color: var(--sm-muted); font-size: 12.5px; max-width: 48ch; }
[data-skill-market] .sm-dropzone .sm-dz-actions { margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; }
/* The one action in the dropzone, so it carries its own weight rather than looking like a link. */
[data-skill-market] .sm-dropzone .sm-dz-browse {
  height: 40px; padding: 0 22px; font-size: 13.5px; border-radius: 10px;
}
[data-skill-market] .sm-dropzone .sm-dz-browse svg { width: 16px; height: 16px; }

/* ── confirmation dialog ───────────────────────────────────────────── */
[data-skill-market] .sm-confirm-layer { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; }
[data-skill-market] .sm-confirm-scrim {
  position: absolute; inset: 0; background: var(--sm-scrim);
  backdrop-filter: blur(2px); animation: sm-fade .14s ease;
}
[data-skill-market] .sm-confirm {
  position: relative; width: min(400px, calc(100% - 40px));
  background: var(--sm-surface); border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg); box-shadow: var(--sm-shadow-md);
  padding: 20px; animation: sm-pop .16s cubic-bezier(.2, .9, .3, 1.1);
}
[data-skill-market] .sm-confirm-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
[data-skill-market] .sm-confirm-body { margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--sm-fg); }
/* The concrete target, so the answer is informed rather than about "the skill" in the abstract. */
[data-skill-market] .sm-confirm-detail {
  margin-top: 10px; padding: 8px 10px; border-radius: 8px;
  background: var(--sm-bg); border: 1px solid var(--sm-border);
  font-size: 11.5px; color: var(--sm-muted); overflow-wrap: anywhere;
}
[data-skill-market] .sm-confirm-actions { margin-top: 18px; display: flex; justify-content: flex-end; gap: 9px; }
[data-skill-market] .sm-btn-danger {
  background: var(--sm-danger); border-color: var(--sm-danger); color: var(--sm-surface);
}
[data-skill-market] .sm-btn-danger:hover { background: color-mix(in oklch, var(--sm-danger) 86%, var(--sm-fg)); }
[data-skill-market] .sm-btn-danger:focus-visible { outline: 2px solid var(--sm-danger-soft); outline-offset: 2px; }
@keyframes sm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sm-pop { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }

/* ── inspector drawer ──────────────────────────────────────────────── */
[data-skill-market] .sm-scrim {
  position: absolute; inset: 0; z-index: 35; background: var(--sm-scrim);
  opacity: 0; pointer-events: none; transition: opacity .22s ease;
}
[data-skill-market] .sm-scrim.show { opacity: 1; pointer-events: auto; }
[data-skill-market] .sm-inspector {
  position: absolute; top: 0; right: 0; bottom: 0; width: 560px; max-width: 94%;
  z-index: 40; background: var(--sm-surface); border-left: 1px solid var(--sm-border);
  box-shadow: var(--sm-shadow-md);
  transform: translateX(101%); transition: transform .24s cubic-bezier(.4, 0, .2, 1);
  display: flex; flex-direction: column;
}
[data-skill-market] .sm-inspector.open { transform: none; }
[data-skill-market] .sm-insp-head { padding: 20px 20px 0; }
[data-skill-market] .sm-insp-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
[data-skill-market] .sm-insp-head h2 { font-size: 21px; letter-spacing: -0.02em; margin-top: 14px; }
[data-skill-market] .sm-insp-pub {
  display: flex; align-items: center; gap: 6px; color: var(--sm-muted);
  font-size: 13px; margin-top: 5px; flex-wrap: wrap;
}
[data-skill-market] .sm-insp-pub .sm-verified svg { width: 14px; height: 14px; }
[data-skill-market] .sm-dot-sep { opacity: .5; }
[data-skill-market] .sm-insp-actions { display: flex; gap: 9px; margin-top: 16px; }
[data-skill-market] .sm-insp-actions .sm-btn { flex: 1; justify-content: center; }
[data-skill-market] .sm-insp-meta {
  display: flex; gap: 14px; flex-wrap: wrap; margin-top: 13px;
  font-family: var(--sm-font-mono); font-size: 11.5px; color: var(--sm-muted);
}
/* a stray backtick:  here */
[data-skill-market] .sm-tabs {
  display: flex; gap: 2px; padding: 14px 20px 0; border-bottom: 1px solid var(--sm-border);
  /* The labels are nowrap, so a narrow drawer scrolls the strip. The scrollbar is hidden for the same
     reason the view bar hides its own: a scrollbar ranged along the drawer's tab row reads as a layout
     defect, and the strip still scrolls by wheel, trackpad and keyboard. */
  position: sticky; top: 0; background: var(--sm-surface);
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
}
[data-skill-market] .sm-tabs::-webkit-scrollbar { display: none; }
[data-skill-market] .sm-tab {
  padding: 9px 11px 11px; font-size: 13px; color: var(--sm-muted); font-weight: 500;
  border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap;
  transition: color .13s ease, border-color .13s ease;
}
/* A tab that carries an icon, for the one whose subject the icon already means. Six tabs is enough
   that the shield earns its place as a landmark; the others stay plain text. */
[data-skill-market] .sm-tab-icon {
  display: inline-flex; align-items: center; gap: 5px;
}
[data-skill-market] .sm-tab-icon svg { width: 13px; height: 13px; }
/* The scan passed. Deliberately the **icon only**: the tab is named 安全扫描, so tinting its label
   green would read as "safe scan" — a verdict on a scan that may not have passed. A green shield
   beside neutral text says "this passed" without turning the tab's own name into a claim. */
[data-skill-market] .sm-tab.sm-tab-safe svg { color: var(--sm-ok); }
[data-skill-market] .sm-tab:hover { color: var(--sm-fg); }
[data-skill-market] .sm-tab.active { color: var(--sm-fg); border-bottom-color: var(--sm-fg); }
[data-skill-market] .sm-insp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }
[data-skill-market] .sm-insp-body h4 {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--sm-muted);
  font-family: var(--sm-font-mono); font-weight: 500; margin: 22px 0 10px;
}
[data-skill-market] .sm-insp-body h4:first-child { margin-top: 0; }
[data-skill-market] .sm-insp-body p { font-size: 13.5px; color: var(--sm-fg); line-height: 1.62; }
[data-skill-market] .sm-insp-body p + p { margin-top: 10px; }
[data-skill-market] .sm-body-note { color: var(--sm-muted); font-size: 12.5px; margin-bottom: 6px; }
[data-skill-market] .sm-feat-list { display: flex; flex-direction: column; gap: 9px; padding: 0; margin: 0; }
[data-skill-market] .sm-feat-list li { display: flex; gap: 9px; font-size: 13.5px; list-style: none; }
[data-skill-market] .sm-feat-list li svg { width: 16px; height: 16px; color: var(--sm-ok); flex: 0 0 auto; margin-top: 3px; }

/* ── rendered Markdown (a skill's own SKILL.md) ─────────────────────── */
[data-skill-market] .sm-md { font-size: 13.5px; line-height: 1.66; color: var(--sm-fg); }
[data-skill-market] .sm-md > * + * { margin-top: 10px; }
[data-skill-market] .sm-md h3,
[data-skill-market] .sm-md h4,
[data-skill-market] .sm-md h5,
[data-skill-market] .sm-md h6 { font-size: 13.5px; font-weight: 650; margin-top: 18px; }
[data-skill-market] .sm-md ul { padding-left: 20px; }
[data-skill-market] .sm-md li { list-style: disc; }
[data-skill-market] .sm-md li + li { margin-top: 4px; }
[data-skill-market] .sm-md code {
  font-family: var(--sm-font-mono); font-size: 12px; padding: 1px 5px;
  border-radius: 5px; background: var(--sm-bg); border: 1px solid var(--sm-border);
}
[data-skill-market] .sm-md pre {
  background: var(--sm-bg); border: 1px solid var(--sm-border); border-radius: 9px;
  padding: 11px 13px; overflow-x: auto;
}
[data-skill-market] .sm-md pre code { background: none; border: 0; padding: 0; font-size: 12px; line-height: 1.55; }
[data-skill-market] .sm-md blockquote {
  border-left: 3px solid var(--sm-accent-line); padding: 2px 0 2px 12px; color: var(--sm-muted);
}

/* ── file tree (flat upstream paths, drawn as a hierarchy) ──────────── */
[data-skill-market] .sm-tree {
  border: 1px solid var(--sm-border); border-radius: 10px; overflow: hidden;
  background: var(--sm-bg); margin-top: 6px;
}
[data-skill-market] .sm-tree-row {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 5px 10px; font-size: 12.5px; color: var(--sm-fg);
  background: none; border: 0; text-align: left; font: inherit;
}
[data-skill-market] .sm-tree-dir { cursor: pointer; font-weight: 600; }
[data-skill-market] .sm-tree-dir:hover { background: var(--sm-accent-soft); }
[data-skill-market] .sm-tree-row svg { flex: 0 0 auto; color: var(--sm-muted); }
[data-skill-market] .sm-tree-dir svg:last-of-type { color: var(--sm-accent); }
[data-skill-market] .sm-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-skill-market] .sm-tree-file .sm-tree-name { font-family: var(--sm-font-mono); font-size: 12px; }
[data-skill-market] .sm-tree-meta { color: var(--sm-muted); font-size: 11px; flex: 0 0 auto; }
[data-skill-market] .sm-tree-ic { width: 13px; flex: 0 0 auto; }
[data-skill-market] .sm-tree-file:hover { background: var(--sm-accent-soft); }

/* ── file preview ───────────────────────────────────────────────────── */
[data-skill-market] .sm-preview-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;
}
[data-skill-market] .sm-preview-path {
  font-size: 11.5px; color: var(--sm-muted); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
[data-skill-market] .sm-preview-label {
  font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  color: var(--sm-muted); margin: 0 0 6px;
}
[data-skill-market] .sm-preview-code {
  background: var(--sm-bg); border: 1px solid var(--sm-border); border-radius: 10px;
  padding: 12px 14px; overflow: auto; max-height: 60vh;
}
[data-skill-market] .sm-preview-code code {
  font-family: var(--sm-font-mono); font-size: 12px; line-height: 1.55;
  white-space: pre; color: var(--sm-fg);
}

/* ── version history ────────────────────────────────────────────────── */
[data-skill-market] .sm-versions { display: flex; flex-direction: column; gap: 0; }
[data-skill-market] .sm-version-row {
  display: flex; gap: 11px; align-items: flex-start;
  padding: 11px 0; border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-version-row:last-child { border-bottom: 0; }
[data-skill-market] .sm-version-tag {
  flex: 0 0 auto; min-width: 58px; font-size: 12px; font-weight: 650;
  color: var(--sm-accent); background: var(--sm-accent-soft);
  border-radius: 6px; padding: 3px 7px; text-align: center;
}
[data-skill-market] .sm-version-main { flex: 1; min-width: 0; }
[data-skill-market] .sm-version-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
[data-skill-market] .sm-version-log { font-size: 13px; line-height: 1.5; }
[data-skill-market] .sm-version-date { font-size: 11px; color: var(--sm-muted); margin-top: 3px; }
[data-skill-market] .sm-versions-toggle { margin-top: 11px; }

[data-skill-market] .sm-perm { display: flex; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--sm-border); }
[data-skill-market] .sm-perm:last-child { border-bottom: 0; }
[data-skill-market] .sm-perm .sm-perm-ic {
  width: 34px; height: 34px; flex: 0 0 auto; border-radius: 9px;
  border: 1px solid var(--sm-border); display: grid; place-items: center; color: var(--sm-fg);
}
[data-skill-market] .sm-perm .sm-perm-ic svg { width: 17px; height: 17px; }
[data-skill-market] .sm-perm .sm-perm-main { flex: 1; min-width: 0; }
[data-skill-market] .sm-perm .sm-perm-title { display: flex; align-items: center; gap: 8px; }
[data-skill-market] .sm-perm .sm-perm-title strong { font-size: 13.5px; font-weight: 600; }
[data-skill-market] .sm-perm .sm-perm-desc { font-size: 12.5px; color: var(--sm-muted); margin-top: 3px; }
[data-skill-market] .sm-risk {
  font-family: var(--sm-font-mono); font-size: 10px; letter-spacing: .04em;
  padding: 2px 7px; border-radius: 999px;
}
[data-skill-market] .sm-risk.low { color: var(--sm-muted); background: var(--sm-fg-soft); }
[data-skill-market] .sm-risk.mid { color: var(--sm-warn); background: var(--sm-warn-soft); }
[data-skill-market] .sm-risk.high { color: var(--sm-danger); background: var(--sm-danger-soft); }

/* The counter strip in the drawer's header, between the skill's meta line and the tab strip. It was
   the drawer's footer, then briefly the first item inside 概览 — where it scrolled away with the tab.
   Here it is fixed: the counters are true whichever tab is open. */
[data-skill-market] .sm-stat-strip {
  display: flex; gap: 18px; flex-wrap: wrap; padding: 14px 20px;
  font-family: var(--sm-font-mono); font-size: 11.5px; color: var(--sm-muted);
  border-bottom: 1px solid var(--sm-border);
}
[data-skill-market] .sm-stat-strip .sm-f { display: flex; flex-direction: column; gap: 2px; }
[data-skill-market] .sm-stat-strip .sm-f strong { font-size: 13px; color: var(--sm-fg); font-weight: 600; }

/* ── toast ─────────────────────────────────────────────────────────── */
[data-skill-market] .sm-toast-wrap {
  position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%);
  z-index: 60; display: flex; flex-direction: column; gap: 8px; align-items: center;
  pointer-events: none;
}
[data-skill-market] .sm-toast {
  display: flex; align-items: center; gap: 12px;
  background: var(--sm-fg); color: var(--sm-surface);
  border-radius: var(--sm-radius); padding: 10px 12px 10px 15px;
  box-shadow: var(--sm-shadow-md); font-size: 13px; max-width: min(560px, 88%);
  animation: sm-toast-in .2s ease; pointer-events: auto;
}
[data-skill-market] .sm-toast .sm-toast-undo { color: color-mix(in oklch, var(--sm-surface) 78%, transparent); font-weight: 600; }
[data-skill-market] .sm-toast .sm-toast-undo:hover { color: var(--sm-surface); text-decoration: underline; }
@keyframes sm-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ── responsive ────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  [data-skill-market] .sm-stat-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 920px) {
  [data-skill-market] .sm-stat-cards { grid-template-columns: minmax(0, 1fr); }
  /* The card grid keeps its fluid track; a 240px floor already lands on one
     column at this width, so no override is needed here. */
  [data-skill-market] .sm-inner { padding: 16px 16px 60px; }
  [data-skill-market] .sm-fixed { padding: 14px 16px 0; }
  [data-skill-market] .sm-topbar { padding: 0 14px; gap: 10px; }
  [data-skill-market] .sm-topbar-actions .sm-btn-label { display: none; }
  [data-skill-market] .sm-page-sub { display: none; }
  [data-skill-market] .sm-list-row { grid-template-columns: 34px minmax(0, 1fr); }
  [data-skill-market] .sm-list-row .sm-row-actions { grid-column: 1 / -1; justify-content: flex-end; }
  [data-skill-market] .sm-page-title { font-size: 22px; }
  [data-skill-market] .sm-inspector { width: 100%; max-width: 100%; border-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [data-skill-market] *, [data-skill-market] *::before, [data-skill-market] *::after {
    transition-duration: .001ms !important; animation-duration: .001ms !important;
  }
}
`

    /* ── icons ─────────────────────────────────────────────────────────── */
    const PATHS = {
      'i-grid': 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
      'i-search': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.6-3.6',
      'i-upload': 'M12 15.5V4m0 0-3.6 3.6M12 4l3.6 3.6M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15',
      'i-bookmark': 'M6.5 4h11v15.5l-5.5-3.6-5.5 3.6z',
      'i-bookmark-check': 'M6.5 4h11v15.5l-5.5-3.6-5.5 3.6zM9.5 9.5l1.8 1.8 3.3-3.7',
      'i-bell': 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.5 1.8 5.5 1.8 5.5H4.7s1.8-1 1.8-5.5zM10 18.5a2 2 0 0 0 4 0',
      'i-download': 'M12 4v10.5m0 0-3.6-3.6M12 14.5l3.6-3.6M5 19h14',
      'i-x': 'M6.5 6.5l11 11M17.5 6.5l-11 11',
      'i-check': 'M5 12.5l4.5 4.5L19 7',
      'i-chevron-right': 'M9.5 6l6 6-6 6',
      'i-chevron-down': 'M6 9.5l6 6 6-6',
      'i-refresh': 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5V9H15',
      'i-trash': 'M5 7h14M9.5 7V5h5v2M7 7l.9 12a1 1 0 0 0 1 1h6.2a1 1 0 0 0 1-1L17 7',
      'i-arrow-up-circle': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 16V8.5M12 8.5 8.7 11.8M12 8.5l3.3 3.3',
      'i-globe': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.4 2.6 2.4 14 0 17M12 3.5c-2.4 2.6-2.4 14 0 17',
      'i-folder': 'M3.5 6.5a2 2 0 0 1 2-2h3.4l2 2.3h7.6a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
      'i-file': 'M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM13.5 3v5.5H19M8.5 13h7M8.5 16.5h4.5',
      'i-terminal': 'M3.5 4.5h17v15h-17zM7.5 9.5l3 2.5-3 2.5M13 14.5h3.5',
      'i-table': 'M3.5 4.5h17v15h-17zM3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15',
      'i-type': 'M5 7V5.5h14V7M12 5.5v13M9.5 18.5h5',
      'i-clipboard': 'M6 4.5h12v16H6zM9 4.5V3.5h6v1M9.5 10.5h5M9.5 14h3.5',
      'i-image': 'M3.5 4.5h17v15h-17zM8.5 9.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M4.5 17l4.5-4.5 3.5 3.5 3-3 4.5 4.5',
      'i-sparkle': 'M12 4l1.7 4.6L18.3 10l-4.6 1.7L12 16.3l-1.7-4.6L5.7 10l4.6-1.4zM18.5 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z',
      'i-book': 'M4.5 5.5a2 2 0 0 1 2-2h12v15h-12a2 2 0 0 0-2 2zM4.5 18.5a2 2 0 0 1 2-2h12',
      'i-network': 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18.5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 7v4.5m0 0-5.5 6m5.5-6 5.5 6',
      // A document under a magnifier: reading information about something. This is the glyph for
      // 读取技能元数据; the globe beside it means the skill's own network access.
      'i-metadata': 'M13.6 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M13.6 3l5.4 5.4M13.6 3v5.4H19M16.4 13.2a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8M18.9 19.7l2.6 2.6',
      // A shield with a tick, for the scan verdict. Distinct from `i-shield` (the author-verification
      // mark), which is why this one carries the tick inside it.
      'i-shield-check': 'M12 3 5.5 5.8v5.4c0 4.3 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.3 6.5-8.6V5.8zM9.1 12.1l2 2 3.8-4.4',
      'i-shield': 'M12 3 5.5 5.8v5.4c0 4.3 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.3 6.5-8.6V5.8zM9.2 12l2.1 2.1 3.6-4.2',
      'i-lock': 'M5 10h14v9.5H5zM8 10V7.5a4 4 0 0 1 8 0V10',
      'i-mail': 'M3.5 5h17v14h-17zM4 7.5l8 5.2 8-5.2',
      'i-database': 'M12 3.2c4.14 0 7.5 1.25 7.5 2.8S16.14 8.8 12 8.8 4.5 7.55 4.5 6 7.86 3.2 12 3.2zM4.5 6v12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8V6M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8',
      'i-menu': 'M4 7h16M4 12h16M4 17h16',
      'i-link': 'M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2',
      'i-help': 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.7.35-1.1.85-1.1 1.5v.3M12 16.6a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4z',
    }

    /**
     * Render one stroke icon from the local glyph table.
     * @param {object} props - `name`, `size`, `className`.
     * @returns {object} SVG element.
     */
    function Icon({ name, size, className }) {
      const d = PATHS[name] ?? PATHS['i-file']
      return h('svg', {
        className,
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, h('path', { d }))
    }

    /** The filled verified seal, drawn as a solid mark rather than a stroke. */
    function Verified({ className }) {
      return h('svg', {
        className,
        viewBox: '0 0 24 24',
        width: 14,
        height: 14,
        'aria-hidden': true,
      },
        h('path', {
          fill: 'currentColor',
          d: 'M12 2.6l2.3 1.7 2.8-.2 1 2.6 2.4 1.5-.9 2.7.6 2.8-2.5 1.2-1.5 2.4-2.8-.3L12 21.4l-2.4-1.9-2.8.3-1.5-2.4-2.5-1.2.6-2.8-.9-2.7 2.4-1.5 1-2.6 2.8.2z',
        }),
        h('path', {
          fill: 'none', stroke: 'var(--sm-surface)', strokeWidth: 1.9,
          strokeLinecap: 'round', strokeLinejoin: 'round', d: 'm8.7 12.2 2.2 2.2 4.4-4.6',
        }),
      )
    }

    /** The five-point star used by the compact rating readout. */
    function Star({ size = 13 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': true,
      }, h('path', {
        d: 'M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.85z',
      }))
    }

    /* ── formatting helpers ────────────────────────────────────────────── */

    /**
     * Compact download/star count in the prototype's `128k` style.
     * @param {number} value - Raw count.
     * @returns {string} Compact label.
     */
    function compact(value) {
      const n = Number(value) || 0
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
      if (n >= 100000) return Math.round(n / 1000) + 'k'
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
      return String(n)
    }

    /**
     * The prototype shows a 5-point rating; SkillHub publishes a 0–100000
     * score. The readout is a deterministic, monotonic projection of that
     * score, not a user-rating average, and the inspector says so.
     * @param {number} score - Upstream score.
     * @returns {string} One-decimal rating-like value.
     */
    function scoreToRating(score) {
      const n = Number(score) || 0
      return (4 + Math.min(1, Math.max(0, n) / 100000)).toFixed(1)
    }

    /**
     * Format upstream's score for display.
     *
     * The raw value is a large float — `75093.51584799575` was measured on a real skill — and printing
     * it in full filled the strip with digits nobody can read and implied a precision the number does
     * not have. Rounded to an integer with grouped thousands, which keeps every digit that carries
     * meaning and drops the ones that do not.
     *
     * @param {unknown} score - Upstream score.
     * @returns {string} e.g. `75,094`.
     */
    function formatScore(score) {
      const n = Number(score)
      if (Number.isFinite(n) === false) return '—'
      return Math.round(n).toLocaleString('en-US')
    }

    /**
     * Relative time in the prototype's `3 天前` style.
     *
     * Returns `''` for a timestamp that cannot be a real one, rather than a number. Treating `0`
     * as "the epoch" is how a missing value became "57 年前": absent is not the same as very old,
     * and the caller must be able to tell them apart so it can hide the label instead.
     *
     * @param {number} timestamp - Epoch milliseconds, or 0/undefined when unknown.
     * @returns {string} Relative label, or '' when the time is unknown.
     */
    function relativeTime(timestamp) {
      const value = Number(timestamp)
      // Anything before the harness existed is a placeholder, not a date.
      if (Number.isFinite(value) === false || value < 946684800000) return ''
      const ms = Date.now() - value
      if (ms <= 0) return t('time.justNow')
      const minute = 60000, hour = 60 * minute, day = 24 * hour
      if (ms < hour) return t('time.minutes', { count: Math.max(1, Math.round(ms / minute)) })
      if (ms < day) return t('time.hours', { count: Math.round(ms / hour) })
      if (ms < 30 * day) return t('time.days', { count: Math.round(ms / day) })
      if (ms < 365 * day) return t('time.months', { count: Math.round(ms / (30 * day)) })
      return t('time.years', { count: Math.round(ms / (365 * day)) })
    }

    /**
     * The publisher label: the claim handle when the namespace carries one,
     * otherwise the account handle.
     * @param {object} skill - Normalised skill.
     * @returns {string} Publisher label.
     */
    function publisherOf(skill) {
      return skill.publisher || skill.handle || t('misc.community')
    }

    /* ── upstream access ───────────────────────────────────────────────── */

    /**
     * An error carrying the code the Host sent, so callers can branch on the reason.
     * @param {string} message - What the reader is told.
     * @param {string} code - Machine-readable reason.
     * @returns {Error} The error.
     */
    function fail(message, code) {
      const error = new Error(message)
      error.code = code
      return error
    }

    /**
     * Call the Host, turning a dead connection into the sentence a refused upstream gets.
     *
     * Two different failures arrive here. The Host can answer with its own reason — including
     * `offline` or `timeout`, because *it* could not reach the market — or the Host itself can fail to
     * answer: a restarting harness, a page whose connection dropped, a browser that is offline. The
     * second arrives as a bare `TypeError` carrying an English message, which is not something to show
     * a reader. A request cancelled on purpose passes through untouched, because the callers key their
     * "ignore this one" branch on `AbortError` and must keep seeing it.
     *
     * @param {string} path - Proxy path.
     * @param {object} [init] - Request init.
     * @returns {Promise<Response>} The Host's response.
     * @throws {Error} With code `offline` when the Host could not be reached at all.
     */
    async function hostFetch(path, init) {
      try {
        return await fetch(path, init)
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        throw fail(t('err.offline'), 'offline')
      }
    }

    /**
     * The reason for a failed proxy call, in the reader's language.
     *
     * The Host answers 502 when it could not read the market at all, and its own text for that is a Node
     * message under a Chinese prefix — `技能市场上游请求失败：fetch failed` — which gives the reader
     * nothing to act on. That status gets a sentence of its own instead. Every other status keeps what
     * the Host said: a 400 is the panel's own mistake, and a status the market itself returned carries
     * the market's own reason.
     *
     * @param {any} body - Parsed response body.
     * @param {number} status - HTTP status.
     * @returns {Error} Error carrying `code`.
     */
    function hostFailure(body, status) {
      if (status === 502 || status === 504) return fail(t('err.offline'), 'offline')
      return fail(body?.error ?? t('err.requestFailed', { status }), 'upstream')
    }

    /**
     * Call this plugin's Host proxy with GET.
     * @param {string} path - Proxy path such as `skills` or `categories`.
     * @param {Record<string, string|number|undefined>} [query] - Query values; blanks are dropped.
     * @param {AbortSignal} [signal] - Cancellation.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the upstream reason when the proxy reports one.
     */
    async function api(path, query, signal) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null || value === '') continue
        params.set(key, String(value))
      }
      const suffix = params.toString()
      const response = await hostFetch(`${apiPath(path)}${suffix ? `?${suffix}` : ''}`, { signal })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Call this plugin's Host with a JSON body. Used for the write side —
     * installing and removing a skill on disk — which must happen in Node, not
     * in a page.
     * @param {string} path - Proxy path such as `install`.
     * @param {object} payload - JSON-serialisable request body.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the Host's own reason when the operation fails.
     */
    async function apiPost(path, payload) {
      const response = await hostFetch(apiPath(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Upload one file's bytes to this plugin's Host.
     *
     * The body is the file itself rather than JSON, because an archive is binary: base64 inside
     * JSON would inflate it by a third and need the whole thing held as a string first. The
     * original filename travels in the query, where the Host uses it only to report errors.
     *
     * @param {string} path - Proxy path such as `import`.
     * @param {string} fileName - Original filename.
     * @param {Blob} bytes - File contents.
     * @returns {Promise<any>} Parsed JSON body.
     * @throws {Error} With the Host's own reason when the import fails.
     */
    async function apiUpload(path, fileName, bytes) {
      const response = await hostFetch(`${apiPath(path)}?name=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes,
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw fail(t('err.notJson', { status: response.status }), 'notJson')
      }
      if (!response.ok) throw hostFailure(body, response.status)
      return body
    }

    /**
     * Normalise one upstream record into the shape the UI renders. Every field
     * is either upstream data or an explicit fallback, never a fabrication.
     * @param {object} raw - One `data.skills[]` entry.
     * @param {Array<{key: string, name: string}>} categories - Current category list.
     * @returns {object} Normalised skill.
     */
    function normalizeSkill(raw, categories) {
      const namespace = raw?.namespace ?? {}
      const slug = String(raw?.slug ?? '')
      const handle = String(namespace.handle ?? raw?.ownerName ?? '')
      const canonical = String(namespace.canonicalName ?? (handle && slug ? `@${handle}/${slug}` : slug))
      const categoryKey = String(raw?.category ?? '')
      const categoryName = translatedCategory(categoryKey, categories.find((c) => c.key === categoryKey)?.name ?? categoryKey ?? t('overview.unknownCategory'))
      const tags = Array.isArray(raw?.subCategories)
        ? raw.subCategories.map((entry) => String(entry?.name ?? '')).filter(Boolean).slice(0, 3)
        : []
      return {
        id: canonical || slug || String(raw?.name ?? ''),
        slug,
        canonical,
        name: String(raw?.name ?? slug ?? t('overview.unknownSkill')),
        publisher: String(namespace.displayName ?? '') || handle,
        handle,
        official: raw?.verified === true || raw?.source === 'official' || raw?.source === 'deepseek',
        description: String(raw?.description_zh || raw?.description || '').replace(/\s+/g, ' ').trim(),
        version: String(raw?.version ?? ''),
        installs: Number(raw?.downloads ?? 0),
        stars: Number(raw?.stars ?? 0),
        score: Number(raw?.score ?? 0),
        rating: scoreToRating(raw?.score),
        updatedAt: Number(raw?.updated_at ?? raw?.created_at ?? 0),
        updated: relativeTime(raw?.updated_at ?? raw?.created_at),
        createdAt: Number(raw?.created_at ?? 0),
        iconUrl: typeof raw?.iconUrl === 'string' ? raw.iconUrl : '',
        homepage: publicSkillUrl(raw?.homepage, handle, slug),
        category: categoryKey,
        categoryName,
        source: String(raw?.source ?? 'community'),
        tags: tags.length > 0 ? tags : [categoryName],
        requiresApiKey: String(raw?.labels?.requires_api_key ?? '') === 'true',
        serviceized: raw?.isServiceized === true,
      }
    }

    /**
     * Load one page of skills.
     * @param {{page?: number, pageSize?: number, sortBy?: string, keyword?: string, category?: string, signal?: AbortSignal}} options - Query options.
     * @param {Array<{key: string, name: string}>} categories - Category list for labels.
     * @returns {Promise<{skills: object[], total: number}>} Normalised page.
     */
    async function loadSkills(options, categories) {
      const { signal, ...query } = options
      const body = await api('/skills', query, signal)
      const list = Array.isArray(body?.data?.skills) ? body.data.skills : []
      return {
        skills: list.map((raw) => normalizeSkill(raw, categories)).filter((skill) => skill.id !== ''),
        total: Number(body?.data?.total ?? list.length),
      }
    }

    /* ── persisted client state ────────────────────────────────────────── */

    /**
     * Empty state seed.
     *
     * `view` is deliberately not persisted: the panel always opens on 发现, so that entering
     * from the sidebar lands somewhere predictable rather than wherever the last visit ended.
     *
     * `sortBy` is not persisted either, for the same reason. Entering 发现 should present the catalogue
     * in one predictable order — the most-downloaded first, which is what "the marketplace" means to
     * most people — and a remembered choice from a previous visit made the first screen depend on
     * something the user could not see. Within a session the select works normally; only the value
     * across sessions is dropped. A filter that describes a *preference* (category) is still remembered.
     */
    function emptyState() {
      return {
        view: 'market',
        category: 'all',
        sortBy: DEFAULT_SORT,
        detailTab: 'overview',
        installed: [],
        saved: [],
        /**
         * Full records for saved skills, keyed by id.
         *
         * The favorite list is a set of ids plus these records. Ids alone are not
         * enough: resolving a favorite needs the skill's own fields (name, publisher,
         * downloads, rating), the in-memory catalog is empty on a fresh page load, and
         * a record for a skill is not otherwise retrievable — the upstream list
         * endpoint has no id filter. Without this the 收藏 list renders empty until
         * something happens to populate the catalog again.
         */
        savedSkills: {},
        enabled: {},
      }
    }

    /**
     * The empty document, in the shape the Host stores.
     *
     * Separate from {@link emptyState} because the two differ on purpose: the render state also
     * carries `view`, `sortBy` and `detailTab`, which are never written anywhere. Keeping one
     * object for both would make it easy to persist something by accident.
     *
     * @returns {object} Persisted shape.
     */
    function emptyPersisted() {
      return {
        category: 'all',
        installed: [],
        saved: [],
        savedSkills: {},
        enabled: {},
        /**
         * Directories changed since the Host process started, and the start time they were
         * recorded against. The time is what retires the advice: a set recorded before the
         * running Host started is asking for a restart that has already happened.
         */
        pending: { since: 0, dirs: [] },
      }
    }

    /**
     * The document this page is working from: the one place the panel's durable state lives.
     *
     * It used to be `window.localStorage` — read once at mount, written on every change — but
     * that store belongs to the desktop shell, not to this plugin: one LevelDB per user data
     * directory, shared with DSH's own keys and with every other plugin, addressed by origin
     * rather than by plugin. The document now lives in the file the Host owns
     * (`<profile>/@montersy123-dsh-skill-market/data/panel.json`), and this object is the page's
     * copy of it.
     *
     * ## Why a copy with a deferred write, rather than awaiting the Host
     *
     * `readState()` is called *during* the first render, and a render cannot await a request.
     * So reads are synchronous against this object, and writes update it and POST the whole
     * document immediately — no timer, because a deferred write is a change that closing the page
     * can lose. A failed POST leaves the in-memory copy authoritative for this page's lifetime,
     * which is the degradation the old `try { … } catch { /* storage unavailable *\/ }` had, except
     * that the panel now keeps working against a Host that is merely slow.
     *
     * ## Ordering
     *
     * `hydratePanelState()` runs once, when the client plugin activates, and **no write is
     * allowed before it finishes**: writing first would replace the stored document with the
     * empty defaults this page starts from, which is a data-loss bug rather than a race to
     * tolerate. The panel adopts the hydrated document through `panelListeners`, and the mount
     * reconciliation waits on the same promise, so the Host's answer cannot be overwritten by
     * the ledger it was fetched to correct.
     */
    let panelDocument = emptyPersisted()
    /** Whether the Host's copy has been read yet. Every write is refused until it has. */
    let panelHydrated = false
    /** The one hydration promise, shared by every caller that needs to wait for it. */
    let panelHydration = null
    /** Revision of the document this page last read or wrote, used to notice another window. */
    let panelRevision = 0
    /** Epoch ms the running Host started; the pending set is scoped to it. */
    let panelHostStartedAt = 0
    /** The exact text last handed to the Host, so an unchanged document is never re-sent. */
    let panelFlushed = ''
    /**
     * Whether this page holds changes the Host may not have yet.
     *
     * Read by the periodic sync, which must not adopt another window's copy over them.
     */
    let panelDirty = false
    /** Whether a POST is in flight, so two flushes cannot overlap. */
    let panelFlushing = false
    /**
     * Whether the old Web Storage keys are still holding data that this page adopted.
     *
     * They are deleted only once the document that replaced them has actually been stored — never
     * before. Deleting first is how a migration becomes data loss: a Host half without the `state`
     * route (an older build, a half-finished update) answers 404, the write fails, the keys are
     * already gone, and the favorites have nowhere left to live. That is not hypothetical; it
     * happened, and the values had to be recovered out of LevelDB's write-ahead log.
     */
    let panelLegacyClearPending = false
    /** Panel instances, notified when the document changes underneath them. */
    const panelListeners = new Set()

    /**
     * Reduce an untrusted document to the shape this panel reads.
     *
     * The file is on the user's disk, so a hand edit, an interrupted write or a future version's
     * extra fields must all be survivable: every field is checked and replaced by its default
     * rather than trusted. A field of the wrong type is dropped, never coerced — a string where a
     * list belongs would otherwise render as one favorite per character.
     *
     * A favorite's record is kept only while the favorite list still names its id. The two are one
     * thing — the id list is what renders, the record is what makes it renderable — and an earlier
     * build could drop an id without dropping its record, which then sat in the store forever: not
     * shown, not referred to, and only visible to whoever opened the file. Dropping it here means
     * every load and every write heals that, instead of carrying it forward again.
     *
     * @param {unknown} raw - Parsed file contents, or anything else.
     * @returns {object} Persisted shape.
     */
    function sanitizePersisted(raw) {
      const base = emptyPersisted()
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
      const strings = (value) => (Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry !== '')
        : [])
      const records = (value) => (value !== null && typeof value === 'object' && Array.isArray(value) === false
        ? value
        : {})
      const pending = records(raw.pending)
      const saved = strings(raw.saved)
      const named = new Set(saved)
      const savedSkills = {}
      for (const [id, record] of Object.entries(records(raw.savedSkills))) {
        if (named.has(id)) savedSkills[id] = record
      }
      return {
        category: typeof raw.category === 'string' && raw.category !== '' ? raw.category : base.category,
        installed: Array.isArray(raw.installed) ? raw.installed : base.installed,
        saved,
        savedSkills,
        enabled: records(raw.enabled),
        pending: {
          since: Number.isFinite(Number(pending.since)) ? Number(pending.since) : 0,
          dirs: strings(pending.dirs),
        },
      }
    }

    /**
     * Whether sanitising a stored document dropped any favorite records.
     *
     * Used to decide that the file is worth rewriting as soon as it is read: left alone, a document
     * carrying records its favorite list no longer names would keep them until something else
     * happened to change — which, for a user who is done curating their favorites, is never.
     *
     * @param {unknown} raw - The document as it was stored.
     * @param {object} document - The same document after {@link sanitizePersisted}.
     * @returns {boolean} Whether records were dropped.
     */
    function droppedOrphanRecords(raw, document) {
      const rawRecords = raw !== null && typeof raw === 'object' && Array.isArray(raw) === false
        && raw.savedSkills !== null && typeof raw.savedSkills === 'object'
        ? Object.keys(raw.savedSkills).length
        : 0
      return rawRecords > Object.keys(document.savedSkills).length
    }

    /**
     * Add every favorite the other document holds and this one does not.
     *
     * Only used while the old Web Storage keys still exist, which is the transition window: the file
     * is authoritative for the ledger and the category, but a favorite is a thing the user made and
     * nothing else can reconstruct it.
     *
     * @param {object} base - The document to add to; mutated.
     * @param {object} other - The document being merged in.
     * @returns {boolean} Whether anything was added.
     */
    function mergeFavorites(base, other) {
      let added = false
      const known = new Set(base.saved)
      for (const id of other.saved) {
        if (known.has(id)) continue
        base.saved.push(id)
        known.add(id)
        added = true
      }
      for (const [id, record] of Object.entries(other.savedSkills)) {
        if (base.savedSkills[id] !== undefined) continue
        base.savedSkills[id] = record
        added = true
      }
      return added
    }

    /**
     * Notify every mounted panel that the document changed.
     * @returns {void}
     */
    function notifyPanels() {
      for (const listener of [...panelListeners]) {
        try {
          listener()
        } catch {
          /* one panel's failure must not stop the others, or the flush that notified them */
        }
      }
    }

    /**
     * Read the Web Storage keys an earlier build wrote.
     *
     * Guarded on both sides — the property access and the read — because `localStorage` is
     * exactly the kind of thing that throws when it is unavailable (an opaque origin, a blocked
     * third-party context, a user who disabled site data), and an adoption that cannot happen
     * must not stop the panel from mounting.
     *
     * @returns {{state: object | null, pending: string[] | null}} Whatever could be read.
     */
    function readLegacyStorage() {
      const nothing = { state: null, pending: null }
      try {
        const storage = window.localStorage
        if (storage === null || storage === undefined) return nothing
        let state = null
        try {
          const raw = storage.getItem(LEGACY_STATE_KEY)
          if (raw !== null) state = JSON.parse(raw)
        } catch {
          state = null
        }
        let pending = null
        try {
          const raw = storage.getItem(LEGACY_PENDING_KEY)
          const parsed = raw === null ? null : JSON.parse(raw)
          pending = Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : null
        } catch {
          pending = null
        }
        return { state, pending }
      } catch {
        return nothing
      }
    }

    /**
     * Delete the Web Storage keys an earlier build wrote.
     *
     * Called once the contents have been adopted **and stored**, so the desktop shell's store stops
     * holding this plugin's data at all — which is the point of the move, not a tidy-up.
     *
     * @returns {void}
     */
    function clearLegacyStorage() {
      try {
        window.localStorage.removeItem(LEGACY_STATE_KEY)
        window.localStorage.removeItem(LEGACY_PENDING_KEY)
      } catch {
        /* unreachable storage has nothing to clear */
      }
    }

    /**
     * Put the document back into the Web Storage keys, as a rescue copy.
     *
     * Reached only when the Host cannot store the document it was just sent — an older Host half
     * without the `state` route, or a request that failed. Losing a favorite because the new home
     * for it is unavailable is worse than writing the old home one more time, and the copy is
     * deleted the moment the file store works. The shape is the one the previous build read, so
     * the data also survives a downgrade.
     *
     * @param {object} document - The document to preserve.
     * @returns {void}
     */
    function writeLegacyStorage(document) {
      try {
        window.localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify({
          category: document.category,
          installed: document.installed,
          saved: document.saved,
          savedSkills: document.savedSkills,
          enabled: document.enabled,
        }))
        window.localStorage.setItem(LEGACY_PENDING_KEY, JSON.stringify(document.pending.dirs))
      } catch {
        /* storage unavailable too: the page still holds the document in memory */
      }
    }

    /**
     * Send the document to the Host, looping until the stored copy matches this one.
     *
     * @returns {Promise<void>} Resolves when the attempt is over. A failure is not thrown: the
     *   page keeps its own copy and the next change, or the next focus, tries again.
     */
    async function flushPanelState() {
      if (panelHydrated === false) return
      if (panelFlushing === true) {
        // A write is already on its way and will pick this change up on its next turn.
        panelDirty = true
        return
      }
      panelFlushing = true
      try {
        for (;;) {
          const body = JSON.stringify(panelDocument)
          if (body === panelFlushed) {
            panelDirty = false
            break
          }
          try {
            const answer = await apiPost(STATE_PATH, panelDocument)
            const revision = Number(answer?.revision ?? 0)
            if (Number.isFinite(revision) && revision > 0) panelRevision = revision
            const startedAt = Number(answer?.harnessStartedAt ?? 0)
            if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
          } catch {
            // The Host could not store it. Keep a copy where the older build kept it, so an
            // unavailable file store costs nothing; the copy goes away with the next successful
            // write, which is also the only moment the old keys are deleted.
            writeLegacyStorage(panelDocument)
            break
          }
          // `panelDocument` is re-serialised rather than assumed unchanged: a change that landed
          // while the request was in flight has to be sent too, and must not be recorded as
          // already stored.
          if (JSON.stringify(panelDocument) === body) {
            panelFlushed = body
            panelDirty = false
            if (panelLegacyClearPending === true) {
              clearLegacyStorage()
              panelLegacyClearPending = false
            }
          }
        }
      } finally {
        panelFlushing = false
      }
    }

    /**
     * Write the document, now.
     *
     * Called directly rather than deferred to a timer. Deferring was tried — the idea being that a
     * single user action writes more than one slice (a toggle records the pending directory *and*
     * the enabled map; a save records the id list *and* the record) so one timer could coalesce
     * them into one request. Two reasons it is not worth it:
     *
     *  - **The coalescing already happens.** A second call while a write is in flight marks the
     *    document dirty and returns; the write in flight re-serialises when it lands and sends the
     *    newer document itself, so the requests a burst produces are bounded either way.
     *  - **A timer is a window in which the change is not durable.** The check that first exercised
     *    this path lost the pending set exactly there: the panel wrote it to memory, the timer had
     *    not fired, and the page went away. `localStorage` wrote synchronously; a move to a file is
     *    no reason to start dropping the last change.
     *
     * @returns {void}
     */
    function requestPanelFlush() {
      if (panelHydrated === false) return
      panelDirty = true
      void flushPanelState()
    }

    /**
     * Read the stored document once, adopting anything an earlier build left in Web Storage.
     *
     * Never rejects: an older Host half without the `state` route, or a Host that is not
     * reachable at all, must still leave a working panel — it just cannot remember anything
     * beyond this page.
     *
     * @returns {Promise<void>} Resolves once the document is in memory.
     */
    async function hydratePanelState() {
      let remote = null
      try {
        const answer = await api(STATE_PATH)
        remote = answer?.state ?? null
        const revision = Number(answer?.revision ?? 0)
        if (Number.isFinite(revision) && revision > 0) panelRevision = revision
        const startedAt = Number(answer?.harnessStartedAt ?? 0)
        if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
      } catch {
        /* an older Host, or none: the panel still works, without persistence */
      }
      /** Whether what is now in memory differs from what the Host holds. */
      let changed = false
      const legacy = readLegacyStorage()
      if (remote === null && legacy.state !== null) {
        // Nothing stored yet, so the old keys are the only copy there is: adopt them, or the
        // move would silently discard every favorite and ledger row the user already had. A
        // stored document wins over them, because it is the newer authority.
        panelDocument = sanitizePersisted(legacy.state)
        changed = true
      } else {
        panelDocument = sanitizePersisted(remote)
        // Both copies can be present during the move: a page still running the previous client keeps
        // writing its own keys until it is closed. The file is the newer authority for everything the
        // Host derives — the ledger, the enabled map, the category — but favorites are additive user
        // data, so they are unioned instead of one side winning. Dropping a favorite the user just
        // added in the other window is the worse of the two mistakes; the only thing a union can do
        // wrong is resurrect one they removed moments ago.
        if (legacy.state !== null) {
          const added = mergeFavorites(panelDocument, sanitizePersisted(legacy.state))
          if (added === true) changed = true
        }
        // Records the favorite list no longer names are dropped on the way in, and the file is
        // rewritten for it rather than keeping them until some later change.
        if (droppedOrphanRecords(remote, panelDocument) === true) changed = true
      }
      if (panelDocument.pending.dirs.length === 0 && legacy.pending !== null && legacy.pending.length > 0) {
        panelDocument.pending = { since: panelHostStartedAt, dirs: legacy.pending }
        changed = true
      }
      // Deleted only after the document that replaces them has been stored — see the flag's own
      // note. Adopting without storing, then deleting, is the failure this ordering exists for.
      if (legacy.state !== null || legacy.pending !== null) panelLegacyClearPending = true
      // A pending set recorded before this Host started is asking for a restart that has already
      // happened, so it is spent. Guarded on a known start time: without one the comparison
      // would retire a set that is merely being read on a page that cannot reach the Host.
      if (panelHostStartedAt > 0
        && (panelDocument.pending.since !== panelHostStartedAt || panelDocument.pending.dirs.length === 0)) {
        if (panelDocument.pending.since !== 0 || panelDocument.pending.dirs.length > 0) changed = true
        panelDocument.pending = { since: 0, dirs: [] }
      }
      panelHydrated = true
      if (changed === true) {
        // Adoption has to reach the file to be worth anything — and only then are the old keys
        // deleted, so a write that never lands leaves the data where it was.
        await flushPanelState()
      } else {
        panelFlushed = JSON.stringify(panelDocument)
        if (panelLegacyClearPending === true) {
          clearLegacyStorage()
          panelLegacyClearPending = false
        }
      }
      notifyPanels()
    }

    /**
     * Hydrate once, and hand the same promise to everyone who needs to wait for it.
     * @returns {Promise<void>} Resolves when the document is in memory.
     */
    function panelStateReady() {
      if (panelHydration === null) panelHydration = hydratePanelState()
      return panelHydration
    }

    /**
     * Adopt a document another window wrote.
     *
     * The replacement for the `storage` event: it runs when a panel mounts, when the window
     * regains focus, and on {@link PANEL_SYNC_INTERVAL_MS} while one is open. Refused while this
     * page holds unwritten changes — the window that made the change is the one that knows.
     *
     * @returns {Promise<boolean>} Whether a newer document was adopted.
     */
    async function syncPanelState() {
      if (panelHydrated === false || panelDirty === true || panelFlushing === true) return false
      try {
        const answer = await api(STATE_PATH)
        const revision = Number(answer?.revision ?? 0)
        if (Number.isFinite(revision) === false || revision === panelRevision) return false
        panelRevision = revision
        const startedAt = Number(answer?.harnessStartedAt ?? 0)
        if (Number.isFinite(startedAt) && startedAt > 0) panelHostStartedAt = startedAt
        const stored = answer?.state ?? null
        panelDocument = sanitizePersisted(stored)
        if (panelHostStartedAt > 0 && panelDocument.pending.since !== panelHostStartedAt) {
          panelDocument.pending = { since: 0, dirs: [] }
        }
        // Another window's document is now the stored one. Saying so is what stops this window from
        // writing it straight back — unless sanitising it dropped records, in which case the stored
        // copy is *not* what this page holds and claiming otherwise would leave the leftovers there
        // until the next unrelated change.
        const cleaned = droppedOrphanRecords(stored, panelDocument)
        panelFlushed = cleaned ? '' : JSON.stringify(panelDocument)
        panelDirty = false
        if (cleaned === true) requestPanelFlush()
        notifyPanels()
        return true
      } catch {
        return false
      }
    }

    /**
     * Read persisted state.
     *
     * Synchronous by contract — it is called during the first render — and safe before
     * hydration: it then answers with the defaults, and the panel is told again when the
     * document arrives.
     *
     * @returns {object} Store shape.
     */
    function readState() {
      return {
        ...emptyState(),
        category: panelDocument.category,
        installed: panelDocument.installed,
        saved: panelDocument.saved,
        savedSkills: panelDocument.savedSkills,
        enabled: panelDocument.enabled,
      }
    }

    /**
     * Persist the durable slices of the store.
     *
     * `view` and `sortBy` are not among them — see {@link emptyState}. Everything here is state that
     * should survive a reload; the view and the catalogue's opening order intentionally are not.
     *
     * @param {object} state - Store shape.
     * @returns {void}
     */
    function writeState(state) {
      panelDocument = {
        ...panelDocument,
        category: typeof state.category === 'string' && state.category !== '' ? state.category : panelDocument.category,
        installed: Array.isArray(state.installed) ? state.installed : panelDocument.installed,
        saved: Array.isArray(state.saved) ? state.saved : panelDocument.saved,
        savedSkills: state.savedSkills !== null && typeof state.savedSkills === 'object' && Array.isArray(state.savedSkills) === false
          ? state.savedSkills
          : panelDocument.savedSkills,
        enabled: state.enabled !== null && typeof state.enabled === 'object' && Array.isArray(state.enabled) === false
          ? state.enabled
          : panelDocument.enabled,
      }
      requestPanelFlush()
    }

    /* ── small presentational pieces ───────────────────────────────────── */

    /**
     * The card/inspector glyph plate: upstream artwork when it exists, the
     * category glyph on a tinted plate otherwise.
     * @param {object} props - `skill`, `large`.
     * @returns {object} Element.
     */
    function SkillIcon({ skill, large }) {
      const [broken, setBroken] = React.useState(false)
      const hue = CATEGORY_HUE[skill.category] ?? 240
      const plate = {
        background: `color-mix(in oklch, oklch(64% 0.16 ${hue}) 14%, var(--sm-surface))`,
        color: `oklch(46% 0.16 ${hue})`,
      }
      const className = `sm-skill-icon${large ? ' lg' : ''}${skill.iconUrl && !broken ? '' : ' is-tinted'}`
      if (skill.iconUrl && !broken) {
        return h('span', { className: 'sm-skill-icon' + (large ? ' lg' : '') },
          h('img', { src: skill.iconUrl, alt: '', loading: 'lazy', onError: () => setBroken(true) }))
      }
      return h('span', { className, style: plate },
        h(Icon, { name: CATEGORY_ICON[skill.category] ?? 'i-file', size: large ? 26 : 20 }))
    }

    /**
     * Compact statistics row: download count, rating, save count.
     *
     * Every figure carries an icon instead of a word. The words were `2.4M downloads · ★5.0 · 305 saves` in
     * English, which wrapped onto a second line inside a card and made the row's height depend on the
     * language; an icon is the same width in every language and needs no translation at all. The labels live
     * in `title` and `aria-label`, so the meaning is still available to a mouse and to a screen reader.
     *
     * @param {object} props - `skill`.
     * @returns {object} Element.
     */
    function Stats({ skill }) {
      return h('div', { className: 'sm-stats sm-num' },
        h('span', { className: 'sm-stat', title: t('card.downloads') },
          h(Icon, { name: 'i-download', size: 13 }),
          compact(skill.installs)),
        h('span', { className: 'sm-sep' }, '·'),
        h('span', { className: 'sm-rating', title: t('card.ratingTitle') }, h(Star, null), skill.rating),
        h('span', { className: 'sm-sep' }, '·'),
        h('span', { className: 'sm-stat', title: t('card.saves') },
          h(Icon, { name: 'i-bookmark', size: 13 }),
          compact(skill.stars)))
    }

    /**
     * The bookmark toggle shared by cards and the inspector.
     * @param {object} props - `saved`, `onToggle`, `name`, `size`.
     * @returns {object} Element.
     */
    function SaveButton({ saved, onToggle, name }) {
      return h('button', {
        type: 'button',
        className: 'sm-save-btn' + (saved ? ' saved' : ''),
        'aria-pressed': saved,
        'aria-label': t(saved ? 'card.unsave' : 'card.save', { name }),
        title: t(saved ? 'card.unsaveShort' : 'card.saveShort'),
        onClick: (event) => { event.stopPropagation(); onToggle() },
      }, h(Icon, { name: 'i-bookmark' }))
    }

    /* ── cards ─────────────────────────────────────────────────────────── */

    /**
     * One card in the `全部技能` grid.
     * @param {object} props - `skill`, `installed`, `saved`, `open`, handlers.
     * @returns {object} Element.
     */
    function SkillCard({
      skill, installed, saved, open, installing, installError,
      // Only the local version is used here, for the button's tooltip; the update
      // decision itself belongs to the 已安装 and 收藏 rows.
      update = NO_UPDATE,
      safety = 'unknown',
      onOpen, onInstall, onToggleSave,
    }) {
      return h('article', {
        className: 'sm-card sm-skill-card' + (open ? ' is-open' : ''),
        role: 'button',
        tabIndex: 0,
        'aria-label': t('card.view', { name: skill.name }),
        onClick: onOpen,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() }
        },
      },
        h('div', { className: 'sm-card-top' },
          h(SkillIcon, { skill }),
          h('div', { className: 'sm-card-title' },
            h('div', { className: 'sm-name-row' },
              h('h3', { className: 'sm-skill-name', title: skill.name }, skill.name),
              h(SafetyBadge, { verdict: safety, compact: false }),
              skill.official ? h('span', { className: 'sm-verified', title: t('card.official') }, h(Verified, null)) : null),
            h('span', { className: 'sm-publisher', title: skill.canonical || publisherOf(skill) },
              publisherOf(skill)))),
        // Outside the header, pinned to the card's own corner. It is a per-card action, not part of
        // the skill's identity, so it should not compete with the name for space in the title row —
        // and `sm-card-title` carries right padding to keep a long name clear of it.
        h(SaveButton, { saved, name: skill.name, onToggle: onToggleSave }),
        h('p', { className: 'sm-card-desc' }, skill.description || t('card.noDescription')),
        installError
          ? h('p', { className: 'sm-install-error', title: installError }, installError)
          : null,
        h('div', { className: 'sm-tags' }, skill.tags.map((tag) => h('span', { key: tag, className: 'sm-tag' }, tag))),
        h('div', { className: 'sm-card-foot' },
          h(Stats, { skill }),
          // Two states on a catalog card: 安装 when absent, 已安装 when present. The update
          // affordance deliberately lives on 已安装 and 收藏 only — the catalog is for
          // finding skills, and comparing releases belongs next to the install it would
          // replace.
          installed
            ? h('button', {
              type: 'button',
              className: 'sm-install-btn installed',
              title: update.local === '' ? t('card.installed') : t('misc.localVersion', { version: update.local }),
              onClick: (event) => { event.stopPropagation(); onOpen() },
            }, h(Icon, { name: 'i-check', size: 15 }), t('card.installed'))
            : h('button', {
              type: 'button',
              className: 'sm-install-btn' + (installing ? ' is-busy' : ''),
              disabled: installing,
              'aria-busy': installing,
              onClick: (event) => { event.stopPropagation(); if (!installing) onInstall() },
            }, h(Icon, { name: 'i-download', size: 15 }), t(installing ? 'card.installing' : 'card.install'))))
    }

    /** The update state of a skill whose latest published version is unknown. */
    const NO_UPDATE = Object.freeze({ available: false, local: '', latest: '' })

    /**
     * Compare two release strings, so "forward" and "backward" can be told apart.
     *
     * Numeric segments compare as numbers (`1.21.10` is newer than `1.9.0`, which a string
     * comparison gets wrong), and anything non-numeric is compared literally. A release that
     * cannot be parsed sorts as neither newer nor older, so an unrecognised format never
     * triggers the downgrade prompt.
     *
     * @param {string} left - Candidate version.
     * @param {string} right - Version to compare against.
     * @returns {number} Negative when left is older, positive when newer, 0 when equal or unparseable.
     */
    function compareVersions(left, right) {
      const a = String(left).split('.')
      const b = String(right).split('.')
      const length = Math.max(a.length, b.length)
      for (let index = 0; index < length; index += 1) {
        const x = a[index]
        const y = b[index]
        if (x === y) continue
        if (x === undefined) return -1
        if (y === undefined) return 1
        const nx = /^\d+$/.test(x) ? Number(x) : Number.NaN
        const ny = /^\d+$/.test(y) ? Number(y) : Number.NaN
        if (Number.isNaN(nx) || Number.isNaN(ny)) return 0
        return nx < ny ? -1 : 1
      }
      return 0
    }

    /**
     * Render the small Markdown subset SkillHub's `overviewMd` actually uses.
     *
     * Built as React elements rather than HTML: the overview is author-supplied text from
     * a public registry, so it is treated as data, never as markup. Headings, list items,
     * fenced code, block quotes and paragraphs are recognised; inline emphasis and
     * `code` spans are handled within a line.
     *
     * @param {string} source - Markdown text.
     * @returns {object} Element.
     */
    function Markdown({ source }) {
      const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let list = null
      let code = null
      let paragraph = []

      /** Flush the paragraph being collected. */
      const flushParagraph = () => {
        if (paragraph.length === 0) return
        blocks.push({ kind: 'p', text: paragraph.join(' ') })
        paragraph = []
      }
      /** Flush the list being collected. */
      const flushList = () => {
        if (list === null) return
        blocks.push(list)
        list = null
      }

      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          if (code === null) {
            flushParagraph()
            flushList()
            code = []
          } else {
            blocks.push({ kind: 'code', lines: code })
            code = null
          }
          continue
        }
        if (code !== null) {
          code.push(line)
          continue
        }
        const heading = line.match(/^(#{1,6})\s+(.*)$/)
        if (heading !== null) {
          flushParagraph()
          flushList()
          blocks.push({ kind: 'h', level: heading[1].length, text: heading[2].trim() })
          continue
        }
        const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
        if (bullet !== null) {
          flushParagraph()
          if (list === null) list = { kind: 'ul', items: [] }
          list.items.push(bullet[1].trim())
          continue
        }
        if (line.trim() === '') {
          flushParagraph()
          flushList()
          continue
        }
        if (line.startsWith('>')) {
          flushParagraph()
          flushList()
          blocks.push({ kind: 'quote', text: line.replace(/^>\s?/, '').trim() })
          continue
        }
        flushList()
        paragraph.push(line.trim())
      }
      if (code !== null) blocks.push({ kind: 'code', lines: code })
      flushParagraph()
      flushList()

      /**
       * Render inline `**bold**` and `` `code` `` spans as elements.
       * @param {string} text - One line of text.
       * @returns {Array} React children.
       */
      const inline = (text) => {
        const out = []
        const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
        let last = 0
        let match
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > last) out.push(text.slice(last, match.index))
          if (match[1] !== undefined) out.push(h('strong', { key: `${match.index}b` }, match[1]))
          else out.push(h('code', { key: `${match.index}c` }, match[2]))
          last = match.index + match[0].length
        }
        if (last < text.length) out.push(text.slice(last))
        return out
      }

      return h('div', { className: 'sm-md' }, blocks.map((block, index) => {
        const key = `${block.kind}-${String(index)}`
        if (block.kind === 'h') return h('h' + String(Math.min(block.level + 2, 6)), { key }, inline(block.text))
        if (block.kind === 'ul') return h('ul', { key }, block.items.map((item, i) => h('li', { key: i }, inline(item))))
        if (block.kind === 'code') return h('pre', { key }, h('code', null, block.lines.join('\n')))
        if (block.kind === 'quote') return h('blockquote', { key }, inline(block.text))
        return h('p', { key }, inline(block.text))
      }))
    }

    /**
     * One node of the file tree, rendered recursively and collapsible.
     *
     * The listing arrives flat, so the hierarchy is drawn here. Every directory starts
     * folded: a skill bundle can hold dozens of files across nested folders, and opening
     * one gives the shape of the bundle at a glance instead of a wall of paths. The first
     * level is therefore the most informative view, and a branch opens on request.
     *
     * @param {{nodes: Array<object>, depth?: number, onOpen?: (path: string) => void}} props - Tree nodes, indent, and the file handler.
     * @returns {object} Element.
     */
    function FileTree({ nodes, depth = 0, onOpen }) {
      const [closed, setClosed] = React.useState(() => new Set(nodes.filter((node) => node.kind === 'dir').map((node) => node.path)))
      return h('div', { className: 'sm-tree' }, nodes.map((node) => {
        const isClosed = closed.has(node.path)
        /** Fold or unfold one directory. */
        const toggle = () => {
          setClosed((current) => {
            const next = new Set(current)
            if (next.has(node.path)) next.delete(node.path)
            else next.add(node.path)
            return next
          })
        }
        if (node.kind === 'dir') {
          return h('div', { key: node.path, className: 'sm-tree-group' },
            h('button', {
              type: 'button',
              className: 'sm-tree-row sm-tree-dir',
              style: { paddingLeft: `${String(8 + depth * 16)}px` },
              'aria-expanded': !isClosed,
              onClick: toggle,
            },
              h(Icon, { name: isClosed ? 'i-chevron-right' : 'i-chevron-down', size: 13 }),
              h(Icon, { name: 'i-folder', size: 14 }),
              h('span', { className: 'sm-tree-name' }, node.name),
              h('span', { className: 'sm-num sm-tree-meta' },
                t('files.nodeSummary', { files: node.files, size: humanSize(node.bytes) }))),
            isClosed ? null : h(FileTree, { nodes: node.children, depth: depth + 1, onOpen }))
        }
        // Files are the actionable rows: a button, so the whole row is a click target and
        // the list is reachable by keyboard too.
        return h('button', {
          key: node.path,
          type: 'button',
          className: 'sm-tree-row sm-tree-file',
          style: { paddingLeft: `${String(8 + depth * 16)}px` },
          title: t('files.nodeTitle', { path: node.path }),
          onClick: () => onOpen?.(node.path),
        },
          h('span', { className: 'sm-tree-ic' }),
          h(Icon, { name: 'i-file', size: 14 }),
          h('span', { className: 'sm-tree-name' }, node.name),
          h('span', { className: 'sm-num sm-tree-meta' }, humanSize(node.size)))
      }))
    }

    /**
     * The published version list, with the recent entries in front and the rest folded.
     *
     * Three is the number that fits without pushing 版本与来源 off the screen, and a long
     * history is not read top to bottom — the older rows are there to be available, not to
     * be scanned. The count on the toggle says how much is behind it, so folding never
     * hides the shape of the history.
     *
     * Each row can install that release. Upstream serves any named version's file list and
     * files (`version=` is honoured on both endpoints), so this reinstalls the directory
     * rather than merely labelling it — which is what makes it useful for stepping back
     * from a release that broke something.
     *
     * @param {{versions: Array<object>, installedVersion: string, onInstall: (version: string) => void, busy: boolean}} props - Version records and install wiring.
     * @returns {object} Element.
     */
    function VersionHistory({ versions, installedVersion, onInstall, busy }) {
      const [expanded, setExpanded] = React.useState(false)
      const shown = expanded ? versions : versions.slice(0, 3)
      const hidden = versions.length - shown.length
      return h(React.Fragment, null,
        h('div', { className: 'sm-versions' }, shown.map((entry, index) => {
          const version = String(entry?.version ?? '')
          const isInstalled = version !== '' && version === installedVersion
          return h('div', {
            key: String(entry?.versionId ?? entry?.version ?? index),
            className: 'sm-version-row',
          },
            h('span', { className: 'sm-version-tag sm-num' }, 'v' + (version || '—')),
            h('div', { className: 'sm-version-main' },
              h('div', { className: 'sm-version-log' }, String(entry?.changelog ?? '') || t('versions.noChangelog')),
              h('div', { className: 'sm-version-date sm-num' },
                new Date(Number(entry?.createdAt ?? 0) || Date.now()).toLocaleString('zh-CN'))),
            h('div', { className: 'sm-version-actions' },
              index === 0 ? h('span', { className: 'sm-badge plain' }, t('versions.latest')) : null,
              isInstalled
                ? h('span', { className: 'sm-badge plain' }, t('card.installed'))
                : h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-secondary sm-btn-sm',
                  disabled: busy,
                  onClick: () => onInstall(version),
                }, h(Icon, { name: 'i-download', size: 14 }), t('card.install'))))
        })),
        versions.length > 3
          ? h('button', {
            type: 'button',
            className: 'sm-btn sm-btn-secondary sm-btn-sm sm-versions-toggle',
            'aria-expanded': expanded,
            onClick: () => setExpanded((current) => !current),
          }, h(Icon, { name: expanded ? 'i-chevron-down' : 'i-chevron-right', size: 14 }),
          expanded ? t('versions.collapse') : t('versions.expand', { count: hidden }))
          : null)
    }

    /**
     * Loading placeholder shaped like a skill card.
     * @returns {object} Element.
     */
    function SkeletonCard() {
      return h('div', { className: 'sm-skeleton', 'aria-hidden': true },
        h('div', { className: 'sm-sk-head' },
          h('div', { className: 'sm-sk-plate' }),
          h('div', { className: 'sm-sk-lines' },
            h('div', { className: 'sm-sk-line', style: { width: '58%' } }),
            h('div', { className: 'sm-sk-line', style: { width: '34%' } }))),
        h('div', { className: 'sm-sk-line', style: { width: '100%' } }),
        h('div', { className: 'sm-sk-line', style: { width: '82%' } }))
    }

    /**
     * The shared empty/error state.
     * @param {object} props - `icon`, `title`, `body`, `error`, `children`.
     * @returns {object} Element.
     */
    function EmptyState({ icon, title, body, error, children }) {
      return h('div', { className: 'sm-empty' + (error ? ' is-error' : '') },
        h('span', { className: 'sm-empty-mark' }, h(Icon, { name: icon, size: 22 })),
        h('h3', null, title),
        body ? h('p', null, body) : null,
        children ? h('div', { className: 'sm-empty-actions' }, children) : null)
    }

    /**
     * The switch used by installed and imported rows.
     * @param {object} props - `checked`, `label`, `onChange`.
     * @returns {object} Element.
     */
    function Switch({ checked, label, onChange }) {
      return h('label', { className: 'sm-switch', title: t('installed.toggleLabel') },
        h('input', {
          type: 'checkbox',
          checked,
          'aria-label': label,
          onChange: (event) => onChange(event.target.checked),
        }),
        h('span', { className: 'sm-track' }),
        h('span', { className: 'sm-thumb' }))
    }

    /* ── the panel ─────────────────────────────────────────────────────── */

    /**
     * The complete market panel.
     * @param {object} props - Slot props injected by the registration.
     * @returns {object} Element.
     */
    function SkillMarketPanel(props) {
      const store = React.useMemo(() => readState(), [])
      const [view, setView] = React.useState(store.view)
      const [category, setCategory] = React.useState(store.category)
      const [sortBy, setSortBy] = React.useState(store.sortBy)
      const [query, setQuery] = React.useState('')
      const [debouncedQuery, setDebouncedQuery] = React.useState('')
      const [selected, setSelected] = React.useState(null)
      const [detailTab, setDetailTab] = React.useState(store.detailTab)
      /**
       * Full detail for the open skill, fetched from SkillHub on demand.
       *
       * `overviewMd`, the version list and the file listing exist only behind per-skill
       * endpoints, so they cannot ride the list cards. Cached per `@handle/slug` because
       * 62 versions and 84 paths are not worth refetching every time the panel reopens.
       * @type {[Record<string, object>, Function]}
       */
      const [details, setDetails] = React.useState({})
      /**
       * Scan verdicts, keyed by skill id.
       *
       * Fetched separately from `details` because the two are needed at different times: a card needs
       * only the verdict, and pulling a whole detail response (2.3 KB, mostly description) once per
       * card would be wasteful. The Host answers the verdict from its cached detail fetch.
       * @type {[Record<string, {kind: string, verdict?: string, vendors?: Array<object>}>, Function]}
       */
      const [security, setSecurity] = React.useState({})
      /**
       * Ids whose verdict has been asked for, including requests still in flight and ones that
       * failed. Rendering calls the loader, so this is what stops a re-render from re-requesting.
       * @type {React.MutableRefObject<Set<string>>}
       */
      const securityRequests = React.useRef(new Set())
      /**
       * The file whose contents the drawer is previewing, if any.
       *
       * A file's bytes exist only behind a per-file endpoint, so the preview is fetched
       * on demand. Held as `{path, version}` so a preview opened from the version list
       * reads that release rather than the latest.
       * @type {[{path: string, version: string} | null, Function]}
       */
      const [preview, setPreview] = React.useState(null)
      /** Fetched file contents, keyed by `<version>:<path>` so releases do not collide. */
      const [previews, setPreviews] = React.useState({})
      const [installed, setInstalled] = React.useState(store.installed)
      /**
       * Saved skill ids, newest first — the favorite order the panel shows.
       * @type {[string[], Function]}
       */
      const [saved, setSaved] = React.useState(store.saved)
      /**
       * Saved records keyed by id, so the 收藏 list renders on a cold page load
       * without waiting for a catalog page to happen to contain those skills.
       *
       * A favorite with no record here cannot be resolved and is pruned, since this
       * build treats ids-without-records as data to discard rather than migrate.
       * @type {[Record<string, object>, Function]}
       */
      const [savedSkills, setSavedSkills] = React.useState(store.savedSkills)
      const [enabled, setEnabled] = React.useState(store.enabled)
      /**
       * Skills that live on this machine rather than coming from the market.
       *
       * Both origins: `local` for a package imported through this page, and `manual` for a
       * directory the user placed in a root themselves. They belong together here because the page
       * is about local skills, and a hand-copied one is exactly that — reporting it only under
       * 已安装 left this page unable to show what is actually installed locally.
       *
       * Not client state: the directory is the record, exactly as it is for an installed skill.
       * Keeping a separate ledger is what let the panel list an imported skill that existed
       * nowhere — the row was real, the skill was not.
       * @type {Array<object>}
       */
      const imported = React.useMemo(
        () => installed.filter((entry) => entry.origin === 'local' || entry.origin === 'manual'),
        [installed],
      )
      /** Progress of an in-flight local import, or null. */
      const [importProgress, setImportProgress] = React.useState(null)
      /**
       * The confirmation the panel is currently asking, or null.
       *
       * One slot is enough — asking two questions at once is not a state worth supporting, and a
       * second request replaces the first rather than queueing behind a dialog nobody dismissed.
       * @type {[{title: string, body: string, detail: string, confirmLabel: string, danger: boolean, onConfirm: Function} | null, Function]}
       */
      const [confirmRequest, setConfirmRequest] = React.useState(null)
      const [catalog, setCatalog] = React.useState({ skills: [], total: 0 })
      const [status, setStatus] = React.useState('loading')
      const [failure, setFailure] = React.useState('')
      const [categories, setCategories] = React.useState(FALLBACK_CATEGORIES)
      /**
       * Category-vocabulary revision. `-1` means "the vocabulary has not
       * resolved yet": the card loader waits for it, so the first page is
       * labelled with the site's own category names instead of being fetched
       * twice — once with the fallback list and once with the live one.
       */
      const [categoriesRev, setCategoriesRev] = React.useState(-1)
      const [toast, setToast] = React.useState(null)
      const [dragOver, setDragOver] = React.useState(false)
      /**
       * Skill directories whose enable/disable choice was made since this page
       * loaded. Shown as advice to restart; never enforced.
       * @type {[Set<string>, Function]}
       */
      const [pendingRestart, setPendingRestart] = React.useState(() => readPending())
      /** Bumped to force the skill list to reload (refresh action, retry). */
      const [reloadNonce, setReloadNonce] = React.useState(0)
      /**
       * The one in-flight install, if any. A real install downloads a whole
       * file bundle, so the UI must be able to say "installing…" on the exact
       * card and refuse a second click instead of starting a parallel download.
       * @type {[{kind: 'idle'} | {kind: 'installing', id: string, name: string} | {kind: 'failed', id: string, name: string, reason: string}, Function]}
       */
      const [installState, setInstallState] = React.useState({ kind: 'idle' })
      const contentRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const fileRef = React.useRef(null)
      const toastTimer = React.useRef(null)
      /**
       * Whether an install is in flight. A ref, not the state value: the guard
       * must reject a second click that arrives before React has re-rendered,
       * which reading `installState` inside the callback cannot do.
       */
      const installBusy = React.useRef(false)

      /**
       * Every skill this session has seen, so 已安装/收藏 rows survive paging.
       * A ref also keeps the card loader independent of the category list's
       * identity: the newest vocabulary is read at call time.
       */
      const seen = React.useRef(new Map())
      const categoriesRef = React.useRef(categories)
      categoriesRef.current = categories
      const remember = React.useCallback((list) => {
        for (const skill of list) seen.current.set(skill.id, skill)
      }, [])

      /** Persist the durable slices whenever one of them changes. */
      React.useEffect(() => {
        writeState({ category, sortBy, installed, saved, savedSkills, enabled })
      }, [category, sortBy, installed, saved, savedSkills, enabled])

      /**
       * Reconcile the local ledger with the Host on mount.
       *
       * The Host is the authority: it reports every skill actually on disk, so its answer both
       * adopts changed paths/sizes and *creates* rows the panel has never seen. That second half
       * is what makes a locally imported skill appear at all — an earlier version only patched
       * rows already in the ledger, so anything the Host knew and the ledger did not was
       * invisible, which is exactly the case an import produces.
       *
       * A row that the Host does not know about is dropped, except for a legacy favorite whose
       * record has no directory behind it: those predate the directory-is-the-record rule and
       * are kept rather than silently discarded.
       */
      React.useEffect(() => {
        const controller = new AbortController()
        // Hydration first. It replaces the ledger with the stored copy, so reconciling before it
        // settles would let the adoption overwrite the Host's answer with the very rows this
        // effect exists to correct.
        panelStateReady()
          .then(() => api('installed', undefined, controller.signal))
          .then((body) => {
            const hostRows = Array.isArray(body?.skills) ? body.skills : []
            setInstalled((current) => {
              const known = new Set(current.map((entry) => String(entry.id)))
              const fromHost = hostRows.map((host) => {
                const directoryName = String(host.directoryName
                  ?? String(host.directory ?? '').split(/[\\/]/).pop())
                const previous = current.find((entry) => entry.directoryName === directoryName)
                // The Host's `handle`/`slug` are the **upstream** identifiers it recovered from the
                // install record; the directory name only approximates them (`user_814dbe54` is on disk
                // as `user-814dbe54`). Deriving them again from the directory name here undid that and
                // built an id the catalogue never uses — so every catalog card read "not installed".
                // The directory name is still the fallback, for a row the Host could not identify.
                const [directoryHandle, ...directorySlugParts] = directoryName.split('--')
                const handle = String(host.handle ?? '').trim() || directoryHandle
                const slug = String(host.slug ?? '').trim() || directorySlugParts.join('--')
                return {
                  id: `@${handle}/${slug}`,
                  // The Host's answer wins for the time too: it reports the recorded install
                  // time, or the directory's mtime when there is no record. Falling back to 0
                  // here is what produced "安装于 57 年前", so an absent value stays absent.
                  installedAt: Number(host.installedAt ?? 0) || Number(previous?.installedAt ?? 0) || 0,
                  name: host.name,
                  version: host.version || '',
                  latestVersion: host.latestVersion ?? '',
                  directory: host.directory,
                  directoryName,
                  registeredAs: host.name,
                  handle,
                  slug,
                  origin: host.origin ?? 'market',
                  // The Host's own answer for whether it is on, used whenever this browser has no
                  // recorded choice. Guessing from the ledger made a skill that is plainly in the
                  // skill root show as 已停用.
                  enabled: host.enabled !== false,
                  files: host.files,
                  bytes: host.bytes,
                }
              })
              const hostIds = new Set(fromHost.map((entry) => entry.id))
              const orphans = current.filter((entry) => (
                hostIds.has(String(entry.id)) === false
                && String(entry.id).startsWith('local-')
              ))
              return [...fromHost, ...orphans]
            })
            // The `enabled` map is a cache of where the directories are, so it is rebuilt from
            // this answer rather than merged. Merging let an entry from a previous session keep
            // overriding the Host, which is how a skill sitting in the skill root was labelled
            // 已停用 while another view called it enabled.
            setEnabled(Object.fromEntries(hostRows.map((host) => {
              const directoryName = String(host.directoryName
                ?? String(host.directory ?? '').split(/[\\/]/).pop())
              return [directoryName, host.enabled !== false]
            })))
          })
          .catch(() => {
            /* the ledger stays as it was; nothing here is worth an error surface */
          })
        return () => controller.abort()
        // Re-runs whenever a skill is written or toggled, so the cache follows the disk.
      }, [reloadNonce])

      /**
       * Seed the in-memory catalog from the saved records on a cold load.
       *
       * `seen` is a ref, not state, so this runs once: it makes 收藏 rows resolvable
       * before any catalog page arrives, which is what lets the list render after a
       * reload instead of only after the next save. Records are overwritten by live
       * data as pages load, because `remember()` sets the same ids.
       */
      React.useEffect(() => {
        for (const [id, record] of Object.entries(savedSkills)) {
          if (seen.current.has(id) === false) seen.current.set(id, record)
        }
        // `savedSkills` at mount is the persisted snapshot; later writes are already
        // in `seen` through toggleSave/remember, so this must not re-run per change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      /** Search is debounced, mirroring the prototype's 300 ms feel. */
      React.useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
        return () => window.clearTimeout(timer)
      }, [query])

      /*
       * There is deliberately no keyboard shortcut to focus the search field.
       *
       * `/` belongs to the conversation — it opens slash commands — so a window-level
       * listener that calls `preventDefault()` on it is competing for input the panel does
       * not own. The existing guard (skip while an input has focus) only covers the case
       * where focus is already in a field; a `/` typed into the composer while focus sits
       * anywhere else would still be swallowed, and the listener stays armed even when the
       * panel is off screen. `⌘K` is the shell's, which is why the old handler returned
       * early for it and advertised a key it never handled.
       */

      /** Escape closes the inspector, like the prototype. */
      React.useEffect(() => {
        if (selected === null) return undefined
        const onKeyDown = (event) => { if (event.key === 'Escape') setSelected(null) }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [selected])

      /** The category vocabulary is upstream data; fall back to the shipped list. */
      React.useEffect(() => {
        const controller = new AbortController()
        api('/categories', undefined, controller.signal)
          .then((body) => {
            const items = Array.isArray(body?.items) ? body.items : []
            const list = items
              .filter((item) => item?.active !== false && Number(item?.level ?? 1) === 1)
              .filter((item) => HIDDEN_CATEGORIES.has(String(item?.key)) === false)
              .sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0))
              .map((item) => ({ key: String(item.key), name: String(item.name || item.key) }))
            if (list.length > 0) setCategories(list)
            setCategoriesRev((current) => (current < 0 ? 0 : current + 1))
          })
          .catch(() => {
            // The shipped vocabulary already rendered; unblock the card loader.
            setCategoriesRev((current) => (current < 0 ? 0 : current))
          })
        return () => controller.abort()
      }, [])

      /**
       * Fetch the per-category totals once the vocabulary is known.
       *
       * Runs after the vocabulary resolves, and never blocks the card list: the chips
       * render immediately with their names and gain counts when this answers. A
       * failure leaves the chips count-less rather than hiding them.
       */
      React.useEffect(() => {
        if (categoriesRev < 0) return undefined
        const controller = new AbortController()
        api('category-counts', undefined, controller.signal)
          .then((body) => {
            const counts = body?.counts
            if (counts !== null && typeof counts === 'object') {
              const clean = {}
              for (const [key, value] of Object.entries(counts)) {
                if (Number.isFinite(Number(value))) clean[key] = Number(value)
              }
              setCategoryCounts(clean)
            }
          })
          .catch(() => {
            /* counts are decoration: keep the chips without them */
          })
        return () => controller.abort()
      }, [categoriesRev])

      /**
       * The query the catalog currently reflects, and therefore the one every page
       * fetch must use. Held in one place because the first page and each appended
       * page have to agree on it, and because a change here means the accumulated
       * pages are stale.
       */
      const catalogQuery = React.useMemo(() => ({
        sortBy,
        keyword: debouncedQuery.trim(),
        category: category === 'all' ? '' : category,
      }), [sortBy, debouncedQuery, category])

      /** How many rows one page holds. Also the stepping size for the lazy loader. */
      const PAGE_SIZE = 60
      /**
       * How many scan-verdict requests to keep in flight while filling a page of cards.
       *
       * One request per card, and a page is 60 — so this is a deliberate ceiling rather than a
       * measurement. Low enough not to open 60 sockets at once, high enough that a page fills in
       * well under a second against the Host's cache.
       */
      const SECURITY_CONCURRENCY = 6
      const [pageCount, setPageCount] = React.useState(0)
      const [hasMore, setHasMore] = React.useState(false)
      const [loadingMore, setLoadingMore] = React.useState(false)
      /** Guards the loader against the observer firing while a page is in flight. */
      const loadingMoreRef = React.useRef(false)
      /** The sentinel the lazy loader watches. */
      const sentinelRef = React.useRef(null)

      /**
       * Load the first page of a query and replace the catalog.
       *
       * Runs on every filter change, and resets the paging state with it: appended
       * pages belong to the query that produced them, so they are dropped rather than
       * merged into an unrelated result set.
       */
      React.useEffect(() => {
        if (categoriesRev < 0) return undefined
        const controller = new AbortController()
        setStatus('loading')
        setFailure('')
        loadSkills({ page: 1, pageSize: PAGE_SIZE, ...catalogQuery, signal: controller.signal }, categoriesRef.current)
          .then((page) => {
            remember(page.skills)
            setCatalog(page)
            setPageCount(1)
            setHasMore(page.skills.length > 0 && page.skills.length < page.total)
            setStatus('ready')
          })
          .catch((error) => {
            if (error?.name === 'AbortError') return
            setFailure(error instanceof Error ? error.message : String(error))
            setStatus('error')
          })
        return () => controller.abort()
      }, [catalogQuery, categoriesRev, remember, reloadNonce])

      /**
       * Append the next page to the catalog.
       *
       * Idempotent per page number and safe to call repeatedly: the observer can fire
       * more than once while a page is on the wire, and a second request for the same
       * page would duplicate every card. A failure leaves the loaded pages intact and
       * simply stops offering more, because a mid-list error is not worth replacing
       * what already rendered.
       */
      const loadMore = React.useCallback(async () => {
        if (loadingMoreRef.current || hasMore === false || status !== 'ready') return
        loadingMoreRef.current = true
        setLoadingMore(true)
        const nextPage = pageCount + 1
        const controller = new AbortController()
        try {
          const page = await loadSkills(
            { page: nextPage, pageSize: PAGE_SIZE, ...catalogQuery, signal: controller.signal },
            categoriesRef.current,
          )
          if (page.skills.length === 0) {
            setHasMore(false)
            return
          }
          remember(page.skills)
          setCatalog((current) => {
            // Deduplicate by id: upstream paging is offset-based, so a skill inserted
            // between two requests can shift a row into the page just fetched.
            const seenIds = new Set(current.skills.map((skill) => skill.id))
            const fresh = page.skills.filter((skill) => seenIds.has(skill.id) === false)
            return { skills: [...current.skills, ...fresh], total: page.total }
          })
          setPageCount(nextPage)
          setHasMore(page.skills.length > 0 && nextPage * PAGE_SIZE < page.total)
        } catch {
          /* keep what is rendered; the footer offers a retry by scrolling again */
        } finally {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }, [catalogQuery, hasMore, pageCount, remember, status])

      /**
       * Load the next page when the sentinel scrolls into view.
       *
       * The observer is re-created whenever the callback identity changes, which is
       * exactly when the paging state moved — so it always watches the current
       * sentinel with the current page number. Profiles without
       * `IntersectionObserver` (and jsdom) fall through to the explicit button the
       * grid renders, so the list is still reachable without it.
       */
      React.useEffect(() => {
        const node = sentinelRef.current
        if (node === null || typeof window.IntersectionObserver !== 'function') return undefined
        const observer = new window.IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadMore()
        }, { rootMargin: '600px 0px' })
        observer.observe(node)
        return () => observer.disconnect()
      }, [loadMore, hasMore, pageCount])

      /**
       * Adopt the stored document, and keep adopting it.
       *
       * Hydration starts when the client plugin activates, which is normally before this panel is
       * mounted — but "normally" is not a contract, so the listener is attached either way and the
       * document is also applied immediately, which makes the late case work and the early case a
       * no-op. The same subscription covers what the `storage` event used to: another window
       * writing the file raises nothing in this one, so the focus listener and the interval ask
       * the Host instead.
       */
      React.useEffect(() => {
        let live = true
        const adopt = () => {
          if (live === false) return
          const next = readState()
          setCategory(next.category)
          setInstalled(next.installed)
          setSaved(next.saved)
          setSavedSkills(next.savedSkills)
          setEnabled(next.enabled)
          setPendingRestart(readPending())
        }
        panelListeners.add(adopt)
        adopt()
        const onFocus = () => { void syncPanelState() }
        window.addEventListener('focus', onFocus)
        const timer = window.setInterval(() => { void syncPanelState() }, PANEL_SYNC_INTERVAL_MS)
        return () => {
          live = false
          panelListeners.delete(adopt)
          window.removeEventListener('focus', onFocus)
          window.clearInterval(timer)
        }
      }, [])

      /**
       * Reset the drawer when the inspector switches subject.
       *
       * The tab goes back to 概览, and an open file preview is dropped: a preview is one file *of one
       * skill*, so carrying it across a switch left this skill's 文件 tab pointing at the previous
       * skill's path — which, while the cache key was `<version>:<path>`, meant it rendered the
       * previous skill's contents.
       */
      React.useEffect(() => {
        setDetailTab('overview')
        setPreview(null)
      }, [selected])

      /**
       * Bring the list back to its top whenever the result set changes. The head
       * is now fixed, so a reader who filters while scrolled to the middle of the
       * previous list would otherwise keep staring at the middle of the new one.
       */
      React.useEffect(() => {
        if (contentRef.current !== null) contentRef.current.scrollTop = 0
      }, [category, sortBy, debouncedQuery])

      /** Announce a transient message with the prototype's 4.2 s lifetime. */
      const notify = React.useCallback((message, undo) => {
        setToast({ id: Date.now(), message, undo: typeof undo === 'function' ? undo : null })
        if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), 4200)
      }, [])
      React.useEffect(() => () => {
        if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      }, [])

      const installedIds = React.useMemo(() => new Set(installed.map((entry) => entry.id)), [installed])
      const savedIds = React.useMemo(() => new Set(saved), [saved])
      /**
       * The skill a row describes, by its own id.
       * @param {string} id - Skill id.
       * @returns {object | null} Catalog record, or null.
       */
      const findSkill = React.useCallback((id) => seen.current.get(id) ?? null, [])
      const selectedSkill = selected === null ? null : findSkill(selected)

      /**
       * Whether a row's skill is enabled, as the Host reported it.
       *
       * Keyed by **directory name**, not by id. Disabled state is a location on disk, and the
       * directory is the one name the filesystem, the Host and every view agree on. Ids do not
       * qualify: the same skill is `@local/demo` in 已安装 and `local-…` in 本地导入, so an
       * `enabled` map keyed by id let one view call a skill disabled while another called it
       * enabled — and a skill plainly present in the skill root showed as 已停用.
       *
       * @param {object} entry - Installed ledger row.
       * @returns {boolean} True when the skill is on.
       */
      const isEnabled = React.useCallback((entry) => {
        const key = String(entry?.directoryName ?? entry?.id ?? '')
        const chosen = enabled[key]
        if (chosen !== undefined) return chosen !== false
        // No local choice recorded: the Host's answer is the only honest source.
        return entry?.enabled !== false
      }, [enabled])

      /**
       * Record that a skill's enabled state changed since this page loaded.
       *
       * Kept as advice, not as a gate: the change already took effect on the Host,
       * so the panel never blocks or nags. Turning a skill back to its original
       * state removes it from the list again, so the reminder only ever names
       * skills that really differ.
       *
       * @param {string} directoryName - Skill directory name, or '' to skip.
       * @returns {void}
       */
      const markPending = React.useCallback((directoryName) => {
        if (directoryName === '') return
        setPendingRestart((current) => {
          const next = new Set(current)
          next.add(directoryName)
          writePending(next)
          return next
        })
      }, [])

      /**
       * Turn an installed skill on or off in the running session.
       *
       * The switch is not a local flag: it calls the Host, which moves the directory
       * between the skill root and the disabled store and reconciles its live
       * registrations, so the change is durable the moment the Host answers. The row
       * is only updated from the Host's own answer, so the UI cannot disagree with
       * the runtime.
       *
       * The user-facing message is only "restart DeepSeek Harness for this to take
       * effect", because a conversation keeps the tool set and skill catalog its agent
       * was created with — so whether *this* conversation notices is not something the
       * panel can promise.
       *
       * @param {object} skill - Catalog skill or installed row carrying `id`.
       * @param {object} entry - The installed row, which knows the directory.
       * @param {boolean} next - Desired state.
       * @returns {Promise<void>} Resolves once the Host has answered.
       */
      const setSkillEnabled = React.useCallback(async (skill, entry, next) => {
        const directory = String(entry?.directory ?? '').split(/[\\/]/).pop()
        // Keyed by directory name for the same reason `isEnabled` reads it that way: it is the one
        // identifier the filesystem and every view share, so a choice made in one list is seen by
        // the others. An id-keyed write left the other view still calling the skill disabled.
        const key = String(entry?.directoryName ?? skill?.id ?? '')
        if (directory === '') {
          // Nothing on disk to toggle (a legacy bookmark row): local only.
          setEnabled((current) => ({ ...current, [key]: next }))
          return
        }
        setEnabled((current) => ({ ...current, [key]: next }))
        try {
          const body = await apiPost('enabled', { directory, enabled: next })
          const reported = Array.isArray(body?.installed?.skills) ? body.installed.skills : []
          const match = reported.find((row) => String(row.directory).endsWith(directory))
          if (match !== undefined) {
            setEnabled((current) => ({ ...current, [key]: match.enabled === true }))
          }
          markPending(directory)
          notify(t(next ? 'action.enableRestart' : 'action.disableRestart', { name: skill.name }))
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          setEnabled((current) => ({ ...current, [key]: !next }))
          notify(t('action.toggleFailed', { name: skill.name, reason }))
        }
      }, [markPending, notify])

      /**
       * Install a skill for real: ask the Host to download and write it.
       *
       * Nothing is recorded locally until the Host reports success, so the UI can
       * never claim a skill is installed when the bytes did not land. A failure
       * is surfaced with the Host's own reason (network, size ceiling, missing
       * `SKILL.md`, checksum mismatch) instead of a generic error.
       *
       * Reinstalling over an existing skill is the same call, and the Host replaces the
       * directory in one step — so passing `version` is how the version list steps back to
       * an older release. The version recorded is the one the Host reports, which is the
       * release it actually wrote.
       *
       * @param {object} skill - Normalised skill from the catalog.
       * @param {string} [version] - Release to install; latest when omitted.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      const install = React.useCallback(async (skill, version = '') => {
        seen.current.set(skill.id, skill)
        if (installBusy.current) return
        installBusy.current = true
        setInstallState({ kind: 'installing', id: skill.id, name: skill.name })
        notify(t(version === '' ? 'action.installingNamed' : 'action.installingVersion', { name: skill.name, version }))
        try {
          const body = await apiPost('install', {
            slug: skill.slug,
            namespace: skill.handle,
            name: skill.name,
            version: version === '' ? skill.version : version,
          })
          const result = body?.install
          if (result === undefined || typeof result.directory !== 'string') {
            throw new Error(t('action.noInstallResult'))
          }
          const installedVersion = result.version || (version === '' ? skill.version : version)
          setInstalled((current) => {
            const directoryName = String(result.directory).split(/[\\/]/).pop()
            const row = {
              id: skill.id,
              installedAt: Date.now(),
              version: installedVersion,
              directory: result.directory,
              directoryName,
              registeredAs: result.name,
              handle: skill.handle,
              slug: skill.slug,
              origin: 'market',
              files: result.files,
              bytes: result.bytes,
            }
            // Replacing an installed version keeps its row rather than adding a second one.
            const existing = current.findIndex((entry) => entry.id === skill.id)
            if (existing < 0) return [row, ...current]
            const next = [...current]
            next[existing] = row
            return next
          })
          // A reinstall over a parked skill stays parked, so the enable switch must follow
          // the Host's answer rather than being forced on. Claiming it is enabled while the
          // files sit in the disabled store would make the switch lie about the disk.
          const becameEnabled = result.enabled !== false
          // Keyed by directory name, like every other write to this map: an id key used to be
          // written here and read by directory elsewhere, so the two never met.
          const installedKey = String(result.directory).split(/[\\/]/).pop()
          setEnabled((current) => ({ ...current, [installedKey]: becameEnabled }))
          setInstallState({ kind: 'idle' })
          markPending(String(result.directory).split(/[\\/]/).pop())
          notify(becameEnabled
            ? t('action.installedDetail', { name: skill.name, version: installedVersion, files: result.files, directory: result.directory })
            : t('action.updatedParked', { name: skill.name, version: installedVersion, files: result.files }))
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          setInstallState({ kind: 'failed', id: skill.id, name: skill.name, reason })
          notify(t('action.installFailed', { name: skill.name, reason }))
        } finally {
          // Released last, so a second click cannot slip in before React has
          // re-rendered the button out of its busy state.
          installBusy.current = false
        }
      }, [notify])

      /**
       * Find the installed row behind a skill, by identity rather than by id alone.
       *
       * Ids are `@handle/slug`, and the same skill can appear under different publishers —
       * a favorite may carry the record it was saved from while the install came from
       * another. The directory name `<handle>--<slug>` is what the filesystem actually
       * has, so it is the reliable key; the id is only a fallback for rows with no
       * directory of their own.
       *
       * Defined before every consumer: these are `const` arrow functions in one component
       * body, so a later definition is a temporal dead zone at render, not a hoisted call.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {object | undefined} The installed ledger entry.
       */
      const installedEntryFor = React.useCallback((skill) => {
        const handle = String(skill?.handle ?? '')
        const slug = String(skill?.slug ?? '')
        const directoryName = handle !== '' && slug !== '' ? `${handle}--${slug}` : ''
        /**
         * Compare directory names loosely, because the two sides spell the namespace differently.
         *
         * A catalog skill carries the **upstream** handle (`user_814dbe54`), while a ledger row's
         * `directoryName` is what the filesystem has (`user-814dbe54` — `safeSegment` rewrites `_` to
         * `-`). Exact equality therefore never matched for a namespace containing an underscore, which
         * is common, and every consumer of this lookup — the update affordance, the 已安装 button state,
         * the drawer's install check — silently reported "not installed".
         *
         * Folding `_` and `-` together is safe here: a directory name never contains `_`, so nothing
         * distinct is being conflated.
         */
        const canonical = (value) => String(value ?? '').replace(/_/g, '-')
        return installed.find((row) => (
          (directoryName !== '' && canonical(row.directoryName) === canonical(directoryName))
          || row.id === skill?.id
        ))
      }, [installed])

      /**
       * Perform a confirmed uninstall: delete the directory, then drop the ledger row.
       *
       * Split from the asking so the same work can be reached from the dialog's confirm button.
       * Identity, not id: a favorite saved under one publisher must still uninstall the copy that
       * is actually on disk. The Host resolves the root from the directory name, so removing a
       * parked skill works the same as removing a live one.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      /**
       * Perform a confirmed uninstall: delete the directory, then drop the ledger row.
       *
       * Split from the asking so the same work can be reached from the dialog's confirm button.
       * Identity, not id: a favorite saved under one publisher must still uninstall the copy that
       * is actually on disk. The Host resolves the root from the directory name, so removing a
       * parked skill works the same as removing a live one.
       *
       * Removal needs the restart advice as much as an install does, and for the same reason: a
       * conversation keeps the skill catalog and tool set its agent was built with, so the skill keeps
       * loading until the process restarts even though its files are gone. Without this the panel
       * reported a clean removal and the skill carried on working — the user's only clue that something
       * had not taken effect.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {Promise<void>} Resolves once the attempt has been reported.
       */
      const uninstallConfirmed = React.useCallback(async (skill) => {
        const entry = installedEntryFor(skill)
        const directory = entry?.directory
        const directoryName = String(directory ?? entry?.directoryName ?? '').split(/[\\/]/).pop()
        let answer
        if (directory !== undefined) {
          try {
            answer = await apiPost('uninstall', { name: directoryName })
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            notify(t('action.uninstallFailed', { name: skill.name, reason }))
            return
          }
        }
        const rowId = entry?.id ?? skill.id
        setInstalled((current) => current.filter((row) => row.id !== rowId))
        if (selected === rowId) setSelected(null)
        // Marked even though the row is gone: the banner counts changes made this session, and the
        // skill is still live in whatever conversation is already running.
        markPending(directoryName)
        notify(t(answer?.uninstall?.wasDisabled === true ? 'action.removeFromDisabled' : 'action.uninstalledRestart', { name: skill.name }))
      }, [installedEntryFor, markPending, notify, selected])

      /**
       * Ask before removing a skill, then do it.
       *
       * The question is asked in the panel's own dialog rather than `window.confirm`: the native
       * sheet cannot be styled, ignores the surrounding UI, and on the desktop shell looks like a
       * browser warning rather than part of the product. The dialog also names what is about to
       * happen — which directory, and how many files — so the answer is informed.
       *
       * @param {object} skill - Skill or ledger row carrying `id` and `name`.
       * @returns {void}
       */
      const uninstall = React.useCallback((skill) => {
        const entry = installedEntryFor(skill)
        setConfirmRequest({
          title: t('action.uninstalling', { name: skill.name }),
          body: t('action.uninstallBody'),
          detail: entry?.directory === undefined
            ? ''
            : `${String(entry.directory).split(/[\\/]/).pop()}${entry.files ? `（${String(entry.files)} 个文件）` : ''}`,
          confirmLabel: t('action.uninstall'),
          danger: true,
          onConfirm: () => { void uninstallConfirmed(skill) },
        })
      }, [installedEntryFor, uninstallConfirmed])

      const toggleSave = React.useCallback((skill) => {
        setSaved((current) => {
          const has = current.includes(skill.id)
          notify(t(has ? 'action.unsavedNamed' : 'action.savedNamed', { name: skill.name }))
          return has ? current.filter((id) => id !== skill.id) : [skill.id, ...current]
        })
        // Keep the record alongside the id so the favorite survives a reload; drop
        // it on unsave so unbookmarked skills stop occupying storage.
        setSavedSkills((current) => {
          if (current[skill.id] !== undefined) {
            const { [skill.id]: removed, ...rest } = current
            return rest
          }
          return { ...current, [skill.id]: skill }
        })
      }, [notify])

      /** Open a skill's detail drawer, preferring fresh upstream data. */
      /**
       * Whether a skill has no upstream record, so there is nothing for the detail drawer to describe.
       *
       * Three ways a skill gets here, and all of them matter:
       *
       *   `local`  — imported through the panel, so its id is `@local/…`
       *   `manual` — a directory the user placed in a root themselves
       *
       * The origin is the reliable signal when the caller has it: a hand-placed directory is named by
       * the user, so its id looks exactly like a published one (`@libai/1.0.5`) and every detail
       * request for it would be a 404 dressed up as a drawer. The id and handle are checked as a
       * fallback for callers holding only a normalised skill, whose origin was not carried along.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle` and/or `origin`.
       * @param {string} [origin] - The row's origin, when the caller knows it.
       * @returns {boolean} True when the skill exists only on this machine.
       */
      const isLocalSkill = React.useCallback((skill, origin) => {
        const known = String(origin ?? skill?.origin ?? '')
        if (known !== '') return known !== 'market'
        return String(skill?.id ?? '').startsWith('@local/') || String(skill?.handle ?? '') === 'local'
      }, [])

      /**
       * Open the detail drawer for a skill.
       *
       * Refuses a skill with no upstream record rather than showing an empty drawer: every tab in it
       * describes SkillHub, and for a local skill all of it would be empty or invented. Such skills
       * are still listed and still toggleable — only the detail view is withheld.
       *
       * @param {object} skill - Skill or row to describe.
       * @param {string} [origin] - The row's origin, when the caller knows it.
       * @returns {void}
       */
      const openDetail = React.useCallback((skill, origin) => {
        if (isLocalSkill(skill, origin)) return
        seen.current.set(skill.id, skill)
        setSelected(skill.id)
      }, [isLocalSkill])

      /**
       * Fetch the per-skill detail bundle the list endpoint cannot provide.
       *
       * Three upstream resources, one round trip each: the record itself (which carries
       * `overviewMd` and the latest version), the full version list, and the file
       * listing. They are fetched together because the drawer shows all three and a
       * partial answer would render misleading sections — an empty version list reads
       * as "no history" rather than "not loaded yet".
       *
       * A skill with no `@handle/slug` (a local import) has no upstream record, so it is
       * marked as such and the drawer hides those sections instead of erroring.
       *
       * @param {object} skill - Normalised skill, or a row carrying handle/slug.
       * @returns {Promise<void>} Resolves once the attempt has been recorded.
       */
      const loadDetail = React.useCallback(async (skill, options = {}) => {
        const id = String(skill?.id ?? '')
        const slug = String(skill?.slug ?? '')
        const namespace = String(skill?.handle ?? '')
        if (id === '') return
        if (slug === '' || namespace === '' || id.startsWith('local-')) {
          setDetails((current) => ({ ...current, [id]: { kind: 'unavailable' } }))
          return
        }
        setDetails((current) => ({ ...current, [id]: { kind: 'loading' } }))
        const query = { slug, namespace }
        try {
          const [detail, versions, files] = await Promise.all([
            api('skill-detail', query),
            api('skill-versions', query).catch(() => null),
            api('skill-files', query).catch(() => null),
          ])
          const fileList = Array.isArray(files?.files) ? files.files : []
          setDetails((current) => ({
            ...current,
            [id]: {
              kind: 'ready',
              summary: String(detail?.skill?.summary_zh || detail?.skill?.summary || ''),
              latestVersion: String(detail?.latestVersion?.version ?? ''),
              latestChangelog: String(detail?.latestVersion?.changelog ?? ''),
              latestAt: Number(detail?.latestVersion?.createdAt ?? 0),
              sourceUrl: publicSkillUrl(detail?.skill?.sourceUrl, namespace, slug),
              versions: Array.isArray(versions?.versions) ? versions.versions : [],
              files: fileList,
              filesVersion: String(files?.version ?? ''),
            },
          }))
        } catch (error) {
          setDetails((current) => ({
            ...current,
            [id]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
          }))
          if (options.quiet !== true) notify(t('action.detailFailed', { reason: error instanceof Error ? error.message : String(error) }))
        }
      }, [notify])

      /**
       * Load the scan verdict for one skill, at most once.
       *
       * Called while rendering, so it has to be idempotent and must not re-request: the in-flight set
       * is checked first, then the cache. A failure is remembered too — a card that silently retried
       * on every render would hammer the Host for a verdict that is not there.
       *
       * @param {object} skill - Skill carrying `handle`/`slug` and `id`.
       * @returns {void}
       */
      const loadSecurity = React.useCallback((skill) => {
        const id = String(skill?.id ?? '')
        const slug = String(skill?.slug ?? '')
        const namespace = String(skill?.handle ?? '')
        if (id === '' || slug === '' || namespace === '' || id.startsWith('@local/')) return
        if (securityRequests.current.has(id)) return
        securityRequests.current.add(id)
        setSecurity((current) => (current[id] === undefined ? { ...current, [id]: { kind: 'loading' } } : current))
        api('skill-security', { slug, namespace })
          .then((body) => {
            setSecurity((current) => ({
              ...current,
              [id]: {
                kind: 'ready',
                verdict: String(body?.verdict ?? 'unknown'),
                vendors: Array.isArray(body?.vendors) ? body.vendors : [],
              },
            }))
          })
          .catch((error) => {
            setSecurity((current) => ({
              ...current,
              [id]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
            }))
          })
      }, [])

      /**
       * The scan verdict for a skill, for rendering.
       * @param {object} skill - Skill or row carrying `id`.
       * @returns {{kind: string, verdict?: string, vendors?: Array<object>}} Cache entry, or a pending marker.
       */
      const securityFor = React.useCallback(
        (skill) => security[String(skill?.id ?? '')] ?? { kind: 'idle' },
        [security],
      )

      /**
       * Cache key for one file of one skill.
       *
       * The skill is part of the key, and that is the point of it: a path and a version are shared by
       * every skill — `SKILL.md` at the latest release is the common case — so a key without the skill
       * made the second skill's 文件 tab a cache hit on the first skill's text. Keyed by `id`, like the
       * detail and scan caches, because that is the identity the drawer is already showing.
       *
       * @param {object} skill - Skill carrying `id`.
       * @param {string} filePath - Path inside the bundle.
       * @param {string} version - Release the file was read from; '' for latest.
       * @returns {string} Cache key.
       */
      function previewKey(skill, filePath, version) {
        return `${String(skill?.id ?? '')}|${version}:${filePath}`
      }

      /**
       * Load one file's text for the drawer's preview.
       *
       * Keyed by skill, version and path, and skipped when already fetched, so flipping between
       * files and back does not refetch. A file that cannot be read leaves an error in the
       * cache entry and the preview says so rather than showing an empty pane.
       *
       * @param {object} skill - Skill carrying `id`/`handle`/`slug`.
       * @param {string} filePath - Path inside the bundle.
       * @param {string} version - Release to read; '' for latest.
       * @returns {Promise<void>} Resolves once the attempt has been recorded.
       */
      const loadPreview = React.useCallback(async (skill, filePath, version) => {
        const key = previewKey(skill, filePath, version)
        const query = {
          slug: String(skill?.slug ?? ''),
          namespace: String(skill?.handle ?? ''),
          path: filePath,
        }
        if (query.slug === '' || query.namespace === '') {
          setPreviews((current) => ({ ...current, [key]: { kind: 'failed', reason: t('files.noSource') } }))
          return
        }
        if (version !== '') query.version = version
        setPreviews((current) => ({ ...current, [key]: { kind: 'loading' } }))
        try {
          const body = await api('skill-file', query)
          setPreviews((current) => ({
            ...current,
            [key]: {
              kind: 'ready',
              text: typeof body?.text === 'string' ? body.text : '',
              truncated: body?.truncated === true,
              bytes: Number(body?.bytes ?? 0),
            },
          }))
        } catch (error) {
          setPreviews((current) => ({
            ...current,
            [key]: { kind: 'failed', reason: error instanceof Error ? error.message : String(error) },
          }))
        }
      }, [])

      /** Open the preview for one file, fetching it when not already held. */
      const openPreview = React.useCallback((skill, filePath, version = '') => {
        setPreview({ path: filePath, version })
        const key = previewKey(skill, filePath, version)
        if (previews[key] !== undefined) return
        void loadPreview(skill, filePath, version)
      }, [previews, loadPreview])

      /**
       * Install one named release, replacing whatever version is on disk.
       *
       * Installing a release that is not the latest *is* the point — stepping back is why the
       * version list offers it. Only the destructive direction asks first: confirming a forward
       * update would train people to dismiss the prompt, which is exactly when a downgrade slips
       * through.
       */
      const installVersion = React.useCallback((skill, version) => {
        if (version === '') return
        const entry = installedEntryFor(skill)
        const currentVersion = String(entry?.version ?? '')
        if (entry !== undefined && currentVersion !== '' && compareVersions(version, currentVersion) < 0) {
          setConfirmRequest({
            title: t('action.downgrade', { name: skill.name, version }),
            body: t('action.downgradeBody', { current: currentVersion }),
            detail: '',
            confirmLabel: t('action.downgradeConfirm'),
            danger: true,
            onConfirm: () => { void install(skill, version) },
          })
          return
        }
        void install(skill, version)
      }, [install, installedEntryFor])

      /**
       * The latest version this panel knows for one skill, or '' when unknown.
       *
       * Two sources, cheapest first: the installed ledger carries what `/installed`
       * reported, and the detail cache carries what an opened drawer learned. Neither is
       * invented — an unknown latest version simply offers no update.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {string} Version string, or ''.
       */
      const latestFor = React.useCallback((skill) => {
        const fromLedger = installedEntryFor(skill)?.latestVersion
        if (typeof fromLedger === 'string' && fromLedger !== '') return fromLedger
        const detail = details[String(skill?.id ?? '')]
        return detail?.kind === 'ready' ? String(detail.latestVersion ?? '') : ''
      }, [installedEntryFor, details])

      /**
       * Whether one skill can be updated, and to what.
       *
       * Requires all three facts: the skill is installed, its local version is known, and
       * upstream publishes a different one. Any missing piece means no update is offered,
       * which is the honest answer rather than a guess.
       *
       * @param {object} skill - Skill or row carrying `id`, `handle`, `slug`.
       * @returns {{available: boolean, local: string, latest: string}} State.
       */
      const updateStateFor = React.useCallback((skill) => {
        const entry = installedEntryFor(skill)
        const local = String(entry?.version ?? '')
        const latest = latestFor(skill)
        return {
          available: entry !== undefined && local !== '' && latest !== '' && local !== latest,
          local,
          latest,
        }
      }, [installedEntryFor, latestFor])

      /**
       * Load a skill's detail the first time its drawer is opened.
       *
       * Guarded on the absence of a cache entry rather than on `selected` alone: `details`
       * is a dependency, so an unguarded fetch would loop. A cached `failed` entry is also
       * left alone — reopening the drawer is not a retry, and the drawer offers one.
       */
      React.useEffect(() => {
        if (selected === null) return
        const skill = seen.current.get(selected)
        if (skill === undefined) return
        if (details[selected] !== undefined) return
        void loadDetail(skill, { quiet: true })
      }, [selected, details, loadDetail])

      /**
       * Build a directory tree from the flat file list SkillHub publishes.
       *
       * The endpoint returns `path` strings with `/` separators and no hierarchy, so the
       * tree is derived here. Directories sort before files and both sort by name, which
       * is what makes the listing readable at a glance.
       *
       * @param {Array<{path: string, size: number, sha256?: string}>} files - Flat listing.
       * @returns {{nodes: Array<object>, files: number, bytes: number, total: number}} Tree and totals.
       */
      const buildFileTree = React.useCallback((files) => {
        const root = { dirs: new Map(), files: [] }
        for (const entry of files) {
          const path = String(entry?.path ?? '')
          if (path === '') continue
          const segments = path.split('/').filter((segment) => segment !== '' && segment !== '.')
          if (segments.length === 0) continue
          let node = root
          for (const segment of segments.slice(0, -1)) {
            if (node.dirs.has(segment) === false) node.dirs.set(segment, { dirs: new Map(), files: [] })
            node = node.dirs.get(segment)
          }
          node.files.push({ name: segments[segments.length - 1], size: Number(entry?.size ?? 0) })
        }

        /** Recursively turn one node into sorted render data. */
        const render = (node, prefix) => {
          const dirs = [...node.dirs.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, child]) => {
              const children = render(child, `${prefix}${name}/`)
              return {
                kind: 'dir',
                name,
                path: `${prefix}${name}`,
                children: children.nodes,
                files: children.files,
                bytes: children.bytes,
              }
            })
          const leaves = [...node.files]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((file) => ({ kind: 'file', name: file.name, size: file.size, path: `${prefix}${file.name}` }))
          return {
            nodes: [...dirs, ...leaves],
            files: dirs.reduce((total, dir) => total + dir.files, 0) + leaves.length,
            bytes: dirs.reduce((total, dir) => total + dir.bytes, 0)
              + leaves.reduce((total, file) => total + file.size, 0),
          }
        }

        const tree = render(root, '')
        return { nodes: tree.nodes, files: tree.files, bytes: tree.bytes, total: files.length }
      }, [])

      /**
       * Import local skill packages for real: send the bytes, let the Host unpack them.
       *
       * The file used to be read for its name and size and then thrown away, so the panel
       * listed a skill that existed nowhere — not on disk, not in the registry, not callable.
       * Now the archive is uploaded, unpacked into the shared skill root by the Host, and picked
       * up by the next scan, which is what makes it an ordinary local skill.
       *
       * A `.zip` goes as it is; a folder is turned into one first, on this side, so both arrive
       * through the same endpoint and the Host has one format to validate.
       *
       * Files are sent one at a time and failures are reported per file, so one bad package does
       * not stop the rest and the reason names the file it belongs to.
       */
      const addLocalFiles = React.useCallback(async (files) => {
        if (files === null || files === undefined || files.length === 0) return
        const chosen = Array.from(files)
        setImportProgress({ done: 0, total: chosen.length, name: String(chosen[0]?.name ?? '') })
        let done = 0
        const failures = []
        const names = []
        for (const file of chosen) {
          try {
            // A directory carries no name of its own; `relativePath` is the folder the user chose.
            const label = String(file.name ?? '') || String(file.webkitRelativePath ?? '').split('/')[0] || 'skill'
            const body = await apiUpload('import', label, file)
            const result = body?.import
            if (result === undefined || typeof result.directory !== 'string') {
              // Naming what was actually received makes a stub or a shape mismatch debuggable
              // instead of reading as "the Host failed".
              throw new Error(t('import.noResultDetail', { body: JSON.stringify(body)?.slice(0, 160) ?? 'null' }))
            }
            names.push(String(result.name ?? label))
          } catch (error) {
            // One key for the whole line: a filename joined to a reason by a full-width colon is a
            // sentence, and English needs a different separator.
            failures.push(t('import.fileFailed', { name: String(file.name ?? ''), reason: error instanceof Error ? error.message : String(error) }))
          }
          done += 1
          setImportProgress({ done, total: chosen.length, name: String(file.name ?? '') })
        }
        setImportProgress(null)
        // The scan is the ledger: an imported skill is whatever the Host now finds on disk, so
        // asking it again is what makes the new row appear — and it cannot disagree with disk.
        setReloadNonce((current) => current + 1)
        if (failures.length === 0) {
          notify(names.length === 1
            ? t('import.doneOne', { name: names[0] })
            : t('import.doneMany', { count: names.length }))
        } else if (names.length === 0) {
          notify(t('import.failed', { reason: failures[0] }))
        } else {
          notify(t('import.doneMixed', { ok: names.length, failed: failures.length, reason: failures[0] }))
        }
      }, [notify])

      /**
       * Remove a locally imported skill from disk.
       *
       * Routed through the same uninstall as an installed skill, because it *is* the same
       * operation: the directory is the record, so deleting the ledger row without deleting the
       * directory would leave the skill on disk and back in the list after the next scan.
       */
      const removeLocal = React.useCallback(async (row) => {
        await uninstall({ id: row.id, name: row.name, handle: row.handle, slug: row.slug })
      }, [uninstall])

      /** Switch the shell to this panel and reset the scroll position. */
      const goToView = React.useCallback((nextView) => {
        setView(nextView)
        if (contentRef.current !== null) contentRef.current.scrollTop = 0
      }, [])

      const pickFiles = React.useCallback(() => { fileRef.current?.click() }, [])

      /** The header action: open the import view, or the picker when already there. */
      const onImportAction = React.useCallback(() => {
        if (view === 'import') pickFiles()
        else goToView('import')
      }, [view, pickFiles, goToView])

      /* ── derived lists ───────────────────────────────────────────────── */

      const visible = React.useMemo(() => {
        const needle = debouncedQuery.trim().toLowerCase()
        if (needle === '') return catalog.skills
        return catalog.skills.filter((skill) => (
          (skill.name + ' ' + skill.publisher + ' ' + skill.description + ' ' + skill.tags.join(' ') + ' ' + skill.canonical)
            .toLowerCase()
            .includes(needle)
        ))
      }, [catalog.skills, debouncedQuery])

      /**
       * Request scan verdicts for the cards on screen, a few at a time.
       *
       * Declared *after* `visible`: these are `const` bindings in one function body, so reading
       * `visible` from an effect above its declaration would be a temporal dead zone at render.
       *
       * A page holds 60 cards and each verdict is its own request, so firing them all at once would
       * open 60 sockets to the Host on every page load. This walks the list through a small window
       * instead — the cards appear immediately and their badges fill in as answers arrive. Only the
       * rows actually on screen are asked about, so filtering the list does not queue work for cards
       * nobody is looking at.
       *
       * The re-run is harmless by construction: `securityRequests` holds every id already asked
       * about, so a second pass over the same list finds nothing to do and returns without touching
       * the state — no loop.
       *
       * @returns {void}
       */
      React.useEffect(() => {
        const queue = visible.filter((skill) => (
          skill?.id !== undefined
          && security[skill.id] === undefined
          && securityRequests.current.has(String(skill.id)) === false
          && String(skill.id).startsWith('@local/') === false
        ))
        if (queue.length === 0) return undefined
        let cancelled = false
        let cursor = 0
        const worker = () => {
          if (cancelled) return
          const next = queue[cursor]
          cursor += 1
          if (next === undefined) return
          loadSecurity(next)
          // Chained rather than awaited together: the window stays at SECURITY_CONCURRENCY.
          window.setTimeout(worker, 0)
        }
        for (let index = 0; index < SECURITY_CONCURRENCY; index += 1) worker()
        return () => { cancelled = true }
      }, [visible, security, loadSecurity])

      /**
       * Resolve one favorite to something renderable.
       *
       * Two sources only, both of which the current build writes: the in-memory
       * catalog (live upstream detail for anything this page loaded) and the
       * persisted record (which is what makes a favorite survive a reload).
       *
       * Ids saved by the build that persisted ids only resolve to nothing, and are
       * deliberately not rescued: that data is discarded rather than migrated, so
       * there is no third fallback and no background refetch here.
       *
       * `catalog` is a dependency although the body never reads it directly. The
       * lookup goes through the `seen` ref, which mutates without any state change,
       * so without this the callback identity would survive the catalog arriving and
       * every memo built on it would keep returning its first, empty answer.
       *
       * @param {string} id - Skill id.
       * @returns {object | null} Record, or null when nothing can resolve it.
       */
      const resolveSaved = React.useCallback((id) => {
        const live = findSkill(id)
        if (live !== null) return live
        return savedSkills[id] ?? null
      }, [findSkill, savedSkills, catalog])

      // `catalog` keeps this fresh for the same reason `resolveSaved` depends on it:
      // the skill detail comes from the `seen` ref, so only a catalog change tells
      // React that these rows have anything new to show.
      /**
       * Build a renderable record for an installed skill this browser never listed.
       *
       * The ledger row carries the directory name, the registered name, the version and
       * (from the Host) the publisher and slug, which is everything the row and the detail
       * drawer need to start from. Opening the drawer then fills in the real upstream
       * fields, so this record is a starting point, not a substitute.
       *
       * @param {object} entry - Installed ledger entry.
       * @returns {object} Skill-shaped record.
       */
      const skillFromInstalled = React.useCallback((entry) => {
        const directoryName = String(entry.directoryName
          ?? String(entry.directory ?? '').split(/[\\/]/).pop())
        const handle = String(entry.handle ?? directoryName.split('--')[0] ?? '')
        const slug = String(entry.slug ?? (directoryName.includes('--') ? directoryName.slice(directoryName.indexOf('--') + 2) : directoryName))
        return {
          id: entry.id,
          slug,
          canonical: handle === '' ? slug : `@${handle}/${slug}`,
          name: entry.registeredAs || directoryName || String(entry.id),
          publisher: handle || t('misc.localMachine'),
          handle,
          official: false,
          description: t('overview.installedHint'),
          version: String(entry.version ?? ''),
          installs: 0,
          stars: 0,
          score: 0,
          rating: '—',
          updatedAt: 0,
          updated: t('misc.unknown'),
          createdAt: Number(entry.installedAt ?? 0),
          iconUrl: '',
          homepage: '',
          category: '',
          categoryName: t('overview.unknownCategory'),
          source: 'local',
          tags: [],
          requiresApiKey: false,
          serviceized: false,
        }
      }, [])

      const installedRows = React.useMemo(() => installed.map((entry) => ({
        entry,
        skill: findSkill(entry.id) ?? skillFromInstalled(entry),
      })), [installed, findSkill, skillFromInstalled, catalog])

      const savedRows = React.useMemo(() => saved
        .map((id) => ({ id, skill: resolveSaved(id) }))
        .filter((row) => row.skill !== null), [saved, resolveSaved])

      /**
       * Drop favorite ids that cannot be resolved, once the catalog has loaded.
       *
       * Orphaned ids come from the build that persisted ids without records, and the
       * decision here is to discard that data rather than migrate it — so instead of
       * leaving dead entries in storage that will never render, they are pruned. The
       * `status` guard matters: pruning before the first catalog page lands would
       * delete perfectly good favorites that simply have not been fetched yet.
       */
      React.useEffect(() => {
        if (status === 'loading') return
        const orphans = saved.filter((id) => resolveSaved(id) === null)
        if (orphans.length === 0) return
        const dropped = new Set(orphans)
        setSaved((current) => current.filter((id) => dropped.has(id) === false))
        setSavedSkills((current) => {
          const next = { ...current }
          for (const id of orphans) delete next[id]
          return next
        })
        notify(t('error.prunedFavorites', { count: orphans.length }))
      }, [status, saved, resolveSaved, notify])

      /**
       * Per-category totals from the Host.
       *
       * These are whole-category totals, not the size of the loaded page: the chip
       * row must name every category whatever is currently filtered or searched.
       * Deriving them from `catalog.skills` was the bug — filtering to one category
       * left the other chips with no count and the row collapsed to just that chip.
       */
      const [categoryCounts, setCategoryCounts] = React.useState({})

      /**
       * Resolve a category label from the live vocabulary, falling back to a
       * normalised upstream key when the list has not arrived yet.
       * @param {string} key - Category key.
       * @returns {string} Display label.
       */
      const categoryLabel = React.useCallback((key) => {
        if (key === '' || key === undefined || key === null) return t('overview.unknownCategory')
        const upstream = categories.find((entry) => entry.key === key)?.name
        // Upstream sends a Chinese display name; the dictionary can override it per language.
        return translatedCategory(key, upstream ?? key)
      }, [categories])

      /* ── views ───────────────────────────────────────────────────────── */

      /**
       * Fixed head of the 发现 view: title, sort control and the category
       * chips. It sits outside the scroll region, so the filters and the sort
       * order stay reachable however far the card list has been scrolled.
       * @returns {object} Element.
       */
      function marketHead() {
        return h(React.Fragment, null,
          h('div', { className: 'sm-page-head' },
            h('div', null,
              h('p', { className: 'sm-eyebrow' }, t('discover.eyebrow')),
              h('h1', { className: 'sm-page-title' }, t('discover.title')),
              h('p', { className: 'sm-page-sub' },
                t('discover.subtitle'))),
            h('div', { className: 'sm-page-actions' },
              h('span', { className: 'sm-select-wrap' },
                h('select', {
                  value: sortBy,
                  'aria-label': t('sort.aria'),
                  onChange: (event) => setSortBy(event.target.value),
                }, SORTS.map((option) => h('option', { key: option.value, value: option.value }, t(option.label))))))),

          // Above the list it filters, and inside the fixed head — so the search stays
          // reachable while the card list scrolls, which is where someone reading results
          // actually wants it.
          h('div', { className: 'sm-search sm-search-row' },
            h(Icon, { name: 'i-search', size: 16 }),
            h('input', {
              ref: searchRef,
              type: 'search',
              value: query,
              placeholder: t('search.placeholder'),
              'aria-label': t('search.placeholder'),
              autoComplete: 'off',
              onChange: (event) => {
                setQuery(event.target.value)
                if (view !== 'market') setView('market')
              },
            })),

          h('div', { className: 'sm-chips' },
            h('button', {
              type: 'button',
              className: 'sm-chip' + (category === 'all' ? ' active' : ''),
              title: t('discover.all'),
              onClick: () => setCategory('all'),
              // The API total, not `catalog.skills.length`: that is the size of the
              // loaded page, which is what made every count in the panel look wrong.
            }, t('discover.all') + ' ', h('span', { className: 'sm-chip-n' }, catalog.total.toLocaleString('zh-CN'))),
            categories
              .map((entry) => {
                // The chip's own name is either an upstream Chinese name or a dictionary key, so both
                // resolve through the same helper. The tooltip states that the count is the category's
                // total, not the number currently listed.
                const label = translatedCategory(entry.key, entry.name)
                const total = categoryCounts[entry.key]
                return h('button', {
                  key: entry.key,
                  type: 'button',
                  className: 'sm-chip' + (category === entry.key ? ' active' : ''),
                  title: total === undefined
                    ? label
                    : t('discover.chipTitle', { name: label, count: total }),
                  onClick: () => setCategory(entry.key),
                }, label, total === undefined
                  ? null
                  : h('span', { className: 'sm-chip-n' }, total))
              })))
      }

      /** Scrolling body of the 发现 view: failure state and the card grid. */
      function marketBody() {
        const searching = debouncedQuery.trim() !== ''
        return h(React.Fragment, null,
          status === 'error'
            ? h(EmptyState, {
              icon: 'i-help',
              title: t('error.catalog'),
              body: failure,
              error: true,
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => setReloadNonce((current) => current + 1),
            }, h(Icon, { name: 'i-refresh', size: 16 }), t('error.retry')))
            : null,

          status === 'loading' && catalog.skills.length === 0
            ? h('section', null,
              h('div', { className: 'sm-section-head' },
                h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),
                h('span', { className: 'sm-meta sm-num' }, t('status.loading'))),
              h('div', { className: 'sm-grid-cards' }, Array.from({ length: 8 }, (_, index) => h(SkeletonCard, { key: index }))))
            : null,

          status !== 'loading' || catalog.skills.length > 0
            ? h(React.Fragment, null,
              h('section', null,
                h('div', { className: 'sm-section-head' },
                  h('h2', null, category === 'all' ? t('discover.all') : categoryLabel(category)),
                  h('span', { className: 'sm-meta sm-num' },
                    t('discover.total', { total: catalog.total.toLocaleString() })
                    + (searching || category !== 'all'
                      ? t('discover.pageOf', { shown: visible.length.toLocaleString() })
                      : ''))),
                visible.length > 0
                  ? h(React.Fragment, null,
                    h('div', { className: 'sm-grid-cards', 'data-count': visible.length }, visible.map((skill) => h(SkillCard, {
                      key: skill.id,
                      skill,
                      installed: installedIds.has(skill.id),
                      saved: savedIds.has(skill.id),
                      update: updateStateFor(skill),
                      safety: securityFor(skill).verdict ?? 'unknown',
                      open: selected === skill.id,
                      installing: installState.kind === 'installing' && installState.id === skill.id,
                      installError: installState.kind === 'failed' && installState.id === skill.id
                        ? installState.reason
                        : null,
                      onOpen: () => openDetail(skill),
                      onInstall: () => install(skill),
                      onToggleSave: () => toggleSave(skill),
                    }))),
                    // Lazy-load footer: the sentinel is what the observer watches, and
                    // the button is the same action for profiles without an observer
                    // (jsdom, or an environment that blocks it). Saying how many rows
                    // are loaded keeps the state legible while scrolling.
                    h('div', { className: 'sm-loadmore', ref: sentinelRef },
                      hasMore
                        ? h(React.Fragment, null,
                          h('button', {
                            type: 'button',
                            className: 'sm-btn sm-btn-secondary',
                            disabled: loadingMore,
                            onClick: () => { void loadMore() },
                          }, h(Icon, { name: 'i-download', size: 15 }),
                          t(loadingMore ? 'status.loading' : 'card.loadMore')),
                          h('span', { className: 'sm-meta sm-num' },
                            t('card.showing', {
                              shown: visible.length.toLocaleString(),
                              total: catalog.total.toLocaleString(),
                            })))
                        : h('span', { className: 'sm-meta sm-num' },
                          t('card.showingAll', { total: visible.length.toLocaleString() }))))
                  : h(EmptyState, {
                    icon: 'i-search',
                    title: t('empty.noMatch'),
                    body: t('empty.noMatchBody'),
                  })))
            : null)
      }

      /**
       * Fixed head of the 已安装 view: the title and the sync action.
       * @returns {object} Element.
       */
      function installedHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('installed.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.installed')),
            h('p', { className: 'sm-page-sub' },
              t('installed.subtitle', { count: installed.length }))))
      }

      /**
       * Scrolling body of the 已安装 view: restart advice and library rows.
       *
       * There is no "sync details" here any more. Detail comes from SkillHub on demand —
       * the drawer fetches it per skill — and the Host's `/installed` answer supplies the
       * publisher and slug, so a row for a skill this browser never listed can still name
       * itself and open its detail. The banner and button existed only to paper over that
       * gap, and with the gap closed they can no longer become true.
       */
      function installedBody() {
        return h(React.Fragment, null,
          pendingRestart.size > 0
            ? h('div', { className: 'sm-restart-banner' },
              h('span', { className: 'sm-rb-ic' }, h(Icon, { name: 'i-refresh', size: 18 })),
              h('div', { className: 'sm-rb-text' },
                h('strong', null, t('restart.bannerTitle', { count: pendingRestart.size })),
                // Deliberately one line. The panel cannot restart the process, and
                // anything longer invites the user to read a promise into a change
                // whose visibility depends on the conversation the agent was built
                // with. Say what is true and stop.
                h('p', null, t('restart.effect'))),
              h('div', { className: 'sm-rb-actions' },
                h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-ghost sm-btn-sm',
                  title: t('restart.dismissTitle'),
                  onClick: () => {
                    setPendingRestart(new Set())
                    writePending(new Set())
                  },
                }, t('restart.dismiss'))))
            : null,

          installed.length === 0
            ? h(EmptyState, {
              icon: 'i-download',
              title: t('empty.noInstalled'),
              body: t('empty.noInstalledBody'),
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => goToView('market'),
            }, t('empty.goDiscover')))
            : h('div', { className: 'sm-list' }, installedRows.map(({ entry, skill }) => {
              const name = skill?.name ?? entry.id
              return h('div', { className: 'sm-list-row', key: entry.id },
                h(SkillIcon, { skill: skill ?? { category: '', iconUrl: '' } }),
                h('div', { className: 'sm-row-main' },
                  h('div', { className: 'sm-name-row' },
                    h('h3', null, name),
                    skill?.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null,
                    isEnabled(entry) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),
                  h('div', { className: 'sm-row-sub' },
                    h('span', { className: 'sm-num' }, 'v' + (entry.version || skill?.version || '—')),
                    h('span', { className: 'sm-sep' }, '·'),
                    // A locally imported skill has no publisher, so the badge says where it came from
                    // instead. A hand-placed directory is named too, because only one of the two came
                    // through this panel. A `manual` skill with a catalogue record still names its
                    // publisher below, and that is deliberate: it has one.
                    entry.origin === 'local' || entry.origin === 'manual'
                      ? t(entry.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')
                      : (skill ? publisherOf(skill) : t('misc.machineRecord')),
                    // Shown only when there is a number. A skill with no catalog record has no download
                    // count, and `0` is what an absent count looks like — printing it states a fact
                    // nobody measured. Keyed on `local` alone: a hand-placed directory can still have a
                    // publisher record, and then its download count is real.
                    entry.origin === 'local' || Number(skill?.installs ?? 0) <= 0
                      ? null
                      : h(React.Fragment, null,
                        h('span', { className: 'sm-sep' }, '·'),
                        h('span', { className: 'sm-num sm-stat', title: t('card.downloads') },
                          h(Icon, { name: 'i-download', size: 12 }),
                          compact(skill.installs))),
                    relativeTime(entry.installedAt) === ''
                      ? null
                      : h(React.Fragment, null,
                        h('span', { className: 'sm-sep' }, '·'),
                        h('span', { className: 'sm-num' }, t('installed.installedAt', { time: relativeTime(entry.installedAt) })))),
                  entry.directory
                    ? h('div', { className: 'sm-num', style: { fontSize: '11px', color: 'var(--sm-muted)', marginTop: '3px', overflowWrap: 'anywhere' }, title: entry.directory },
                      t('installed.dirPrefix') + entry.directory,
                      entry.files ? t('installed.fileCount', { count: entry.files }) : '')
                    : null),
                h('div', { className: 'sm-row-actions' },
                  entry.directoryName !== undefined && pendingRestart.has(entry.directoryName)
                    ? h('span', { className: 'sm-badge update', title: t('installed.pendingBadgeTitle') }, t('installed.pendingBadge'))
                    : null,
                  h(Switch, {
                    checked: isEnabled(entry),
                    label: t('installed.enableNamed', { name }),
                    onChange: (checked) => setSkillEnabled(skill ?? { id: entry.id, name }, entry, checked),
                  }),
                  // Only when there is something to describe: a local import or a hand-placed directory
                  // has no upstream record, so the button is withheld rather than opening a drawer of
                  // empty tabs. The origin is what says so — the id of a hand-placed directory looks
                  // exactly like a published one.
                  skill && isLocalSkill(skill, entry.origin) === false
                    ? h('button', {
                      type: 'button',
                      className: 'sm-btn sm-btn-secondary sm-btn-sm',
                      onClick: () => openDetail(skill, entry.origin),
                    }, t('installed.details'))
                    : null,
                  // The library is where an outdated install is most visible, so the update
                  // belongs here as well as on the favorite row.
                  skill !== null && updateStateFor(skill).available
                    ? h('button', {
                      type: 'button',
                      className: 'sm-btn sm-btn-primary sm-btn-sm',
                      disabled: installState.kind === 'installing',
                      title: t('saved.versionArrow', { local: updateStateFor(skill).local, latest: updateStateFor(skill).latest }),
                      onClick: () => installVersion(skill, updateStateFor(skill).latest),
                    }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))
                    : null,
                  h('button', {
                    type: 'button',
                    className: 'sm-icon-btn',
                    'aria-label': t('action.uninstallNamed', { name }),
                    title: t('action.uninstall'),
                    onClick: () => uninstall(skill ?? { id: entry.id, name }),
                  }, h(Icon, { name: 'i-trash' }))))
            })))
      }

      /**
       * Fixed head of the 收藏 view.
       * @returns {object} Element.
       */
      function savedHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('saved.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.saved')),
            h('p', { className: 'sm-page-sub' }, t('saved.subtitle', { count: saved.length }))))
      }

      /** Scrolling body of the 收藏 view: saved rows with a one-click install. */
      function savedBody() {
        return h(React.Fragment, null,
          saved.length === 0
            ? h(EmptyState, {
              icon: 'i-bookmark',
              title: t('empty.noSaved'),
              body: t('empty.noSavedBody'),
            }, h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: () => goToView('market'),
            }, t('empty.goDiscover')))
            : h('div', { className: 'sm-list' }, savedRows.map(({ skill }) => h('div', {
              className: 'sm-list-row',
              key: skill.id,
            },
              h(SkillIcon, { skill }),
              h('div', { className: 'sm-row-main' },
                h('div', { className: 'sm-name-row' },
                  h('h3', null, skill.name),
                  skill.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null),
                h('div', { className: 'sm-row-sub' },
                  publisherOf(skill),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num sm-stat', title: t('card.downloads') },
                    h(Icon, { name: 'i-download', size: 12 }),
                    compact(skill.installs)),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num sm-stat', title: t('card.ratingTitle') },
                    h(Star, { size: 12 }),
                    skill.rating))),
              h('div', { className: 'sm-row-actions' },
                // Same rule as the library row: a skill with no upstream record has no drawer to offer.
                // Kept here too rather than relying on the guard inside openDetail, because a button
                // that does nothing when pressed is its own defect.
                isLocalSkill(skill)
                  ? null
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary sm-btn-sm',
                    // The same drawer the market and library rows open; a favorite is a
                    // skill like any other, so the entries into it must not differ.
                    onClick: () => openDetail(skill),
                  }, t('installed.details')),
                updateStateFor(skill).available
                  ? h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-primary sm-btn-sm',
                    disabled: installState.kind === 'installing',
                    title: 'v' + updateStateFor(skill).local + ' → v' + updateStateFor(skill).latest,
                    onClick: () => installVersion(skill, updateStateFor(skill).latest),
                  }, h(Icon, { name: 'i-arrow-up-circle', size: 15 }), t('saved.update'))
                  : null,
                // 已安装 here follows the same identity rule as the update button: a favorite
                // saved from one publisher must still read as installed when the install came
                // from another.
                installedIds.has(skill.id) || installedEntryFor(skill) !== undefined
                  ? h('span', { className: 'sm-badge plain' }, t('card.installed'))
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary sm-btn-sm',
                    onClick: () => install(skill),
                  }, h(Icon, { name: 'i-download', size: 15 }), t('card.install')),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('card.unsave', { name: skill.name }),
                  title: t('card.unsaveShort'),
                  onClick: () => toggleSave(skill),
                }, h(Icon, { name: 'i-bookmark-check' })))))))
      }

      /**
       * Fixed head of the 本地导入 view.
       * @returns {object} Element.
       */
      function importHead() {
        return h('div', { className: 'sm-page-head' },
          h('div', null,
            h('p', { className: 'sm-eyebrow' }, t('import.eyebrow')),
            h('h1', { className: 'sm-page-title' }, t('view.import')),
            h('p', { className: 'sm-page-sub' }, t('import.subtitle'))))
      }

      /** Scrolling body of the 本地导入 view: dropzone, counters, imported rows. */
      function importBody() {
        const enabledCount = imported.filter((row) => isEnabled(row)).length
        const dropzone = h('div', {
          className: 'sm-dropzone' + (dragOver ? ' dragover' : ''),
          role: 'button',
          tabIndex: 0,
          'aria-label': t('import.dropAria'),
          onClick: pickFiles,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickFiles() }
          },
          onDragOver: (event) => { event.preventDefault(); setDragOver(true) },
          onDragLeave: () => setDragOver(false),
          onDrop: (event) => {
            event.preventDefault()
            setDragOver(false)
            addLocalFiles(event.dataTransfer?.files)
          },
        },
          h('span', { className: 'sm-dz-ic' }, h(Icon, { name: 'i-upload', size: 22 })),
          h('h3', null, t('import.dropTitle')),
          h('p', null, t('import.dropNote')),
          // A span, not a button: the zone itself is the control, and nesting a button inside a
          // clickable element would fire the picker twice.
          h('div', { className: 'sm-dz-actions' },
            h('span', { className: 'sm-btn sm-btn-secondary sm-dz-browse' },
              h(Icon, { name: 'i-folder', size: 16 }), t('import.browse'))))

        return h(React.Fragment, null,
          dropzone,
          h('div', { className: 'sm-stat-cards' },
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statImported')),
              h('div', { className: 'sm-v' }, imported.length)),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statEnabled')),
              h('div', { className: 'sm-v' }, enabledCount)),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('import.statFormat')),
              h('div', { className: 'sm-v' }, '.zip'))),
          importProgress === null
            ? null
            : h('p', { className: 'sm-body-note' },
              t('import.progress', { done: importProgress.done + 1, total: importProgress.total, name: importProgress.name })),
          imported.length === 0
            ? h(EmptyState, {
              icon: 'i-upload',
              title: t('import.empty'),
              body: t('import.emptyBody'),
            })
            : h('div', { className: 'sm-list' }, imported.map((row) => h('div', {
              className: 'sm-list-row',
              key: row.id,
            },
              h(SkillIcon, { skill: { category: '', iconUrl: '' } }),
              h('div', { className: 'sm-row-main' },
                h('div', { className: 'sm-name-row' },
                  h('h3', null, row.name),
                  // Distinguishes a package this page imported from a directory the user placed in
                  // a root by hand: both are local, but only one of them came through the panel.
                  h('span', { className: 'sm-src-badge' }, h(Icon, { name: 'i-folder', size: 11 }),
                    t(row.origin === 'manual' ? 'import.badgeManual' : 'import.badgeLocal')),
                  isEnabled(row) ? null : h('span', { className: 'sm-badge plain' }, t('installed.disabled'))),
                h('div', { className: 'sm-row-sub' },
                  row.version ? h('span', { className: 'sm-num' }, 'v' + row.version) : h('span', null, t('installed.noVersion')),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num', title: row.directory }, t('installed.fileCountBare', { count: row.files ?? 0 })),
                  h('span', { className: 'sm-sep' }, '·'),
                  h('span', { className: 'sm-num' }, humanSize(row.bytes ?? 0)))),
              h('div', { className: 'sm-row-actions' },
                h(Switch, {
                  checked: isEnabled(row),
                  label: t('installed.enableNamed', { name: row.name }),
                  onChange: (checked) => {
                    // `setSkillEnabled(skill, entry, next)`: the skill carries the id the switch
                    // state is keyed by, the entry carries the directory to move on disk.
                    void setSkillEnabled(
                      { id: row.id, name: row.name, handle: row.handle, slug: row.slug },
                      row,
                      checked,
                    )
                  },
                }),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('installed.removeNamed', { name: row.name }),
                  title: t('installed.remove'),
                  onClick: () => removeLocal(row),
                }, h(Icon, { name: 'i-trash' })))))))
      }

      /* ── inspector ───────────────────────────────────────────────────── */

      /**
       * Overview tab: the skill's own `SKILL.md` body, plus the list-card facts.
       *
       * `SKILL.md` is the file the harness actually loads, so this is the same text an
       * installed skill would run — shown before installing. When it cannot be read the
       * tab falls back to the published summary, and says which of the two it is showing
       * rather than passing one off as the other.
       */
      /**
       * Overview tab: the list-card facts, and the published summary when there is one.
       *
       * Deliberately does NOT inline the skill's `SKILL.md`. That body is often thousands of
       * words, and it is already readable in full — with its own directory tree and per-file
       * preview — in 文件. Summarising it here duplicated the source, pushed 关键信息 off the
       * panel, and could only ever be an approximation of a file the user can open directly.
       */
      function overviewTab(skill, detail) {
        const bullets = [
          t(skill.official ? 'overview.fromOfficial' : 'overview.fromCommunity', { canonical: skill.canonical }),
          t('card.categoryLabel', { name: skill.categoryName }),
          skill.version ? t('overview.version', { version: skill.version }) : t('overview.versionMaintained'),
          skill.requiresApiKey ? t('overview.needsKey') : t('overview.noKey'),
        ]
        const summary = detail?.kind === 'ready' ? detail.summary : ''
        return h(React.Fragment, null,
          detail?.kind === 'failed'
            ? h('p', { className: 'sm-body-note' }, t('overview.summaryFailed', { reason: detail.reason }))
            : null,
          detail?.kind === 'ready' && summary !== ''
            ? h(React.Fragment, null, h('h4', null, t('overview.summary')), h('p', null, summary))
            : null,
          detail?.kind === 'ready' && summary === ''
            ? h(React.Fragment, null,
              h('h4', null, t('overview.summary')),
              h('p', null, skill.description || t('card.noDescription')))
            : null,
          h('h4', null, t('overview.keyInfo')),
          h('ul', { className: 'sm-feat-list' },
            bullets.map((text) => h('li', { key: text }, h(Icon, { name: 'i-check', size: 16 }), h('span', null, text)))),
          h('h4', null, t('overview.useCases')),
          h('div', { className: 'sm-tags' },
            skill.tags.map((tag) => h('span', { key: tag, className: 'sm-tag' }, tag)),
            h('span', { className: 'sm-tag' }, skill.categoryName)))
      }

      /**
       * Files tab: the bundle's directory tree, and a preview of whichever file is open.
       *
       * Straight from `/files`, which reports exactly what an install would write — so
       * this is also the place to see what a skill would put on disk before installing it.
       * Clicking a file swaps the tree for its contents; the preview keeps the tree one
       * click away rather than replacing the tab, so reading several files stays quick.
       */
      function filesTab(skill, detail) {
        if (detail === undefined || detail.kind === 'loading') {
          return h('p', { className: 'sm-body-note' }, t('files.loading'))
        }
        if (detail.kind === 'unavailable') {
          return h('p', { className: 'sm-body-note' }, t('files.localHasNone'))
        }
        if (detail.kind === 'failed') {
          return h('p', { className: 'sm-body-note' }, t('files.failed', { reason: detail.reason }))
        }
        const tree = buildFileTree(detail.files)

        // A file is open: show it, with the way back to the listing.
        if (preview !== null) {
          const key = previewKey(skill, preview.path, preview.version)
          const file = previews[key]
          const name = preview.path.split('/').pop()
          const markdown = /\.(md|markdown)$/i.test(preview.path)
          return h(React.Fragment, null,
            h('div', { className: 'sm-preview-head' },
              h('button', {
                type: 'button',
                className: 'sm-btn sm-btn-secondary sm-btn-sm',
                onClick: () => setPreview(null),
              }, h(Icon, { name: 'i-chevron-right', size: 13 }), t('files.back')),
              h('span', { className: 'sm-preview-path sm-num', title: preview.path },
                preview.version === '' ? preview.path : preview.path + ' · v' + preview.version)),
            file === undefined || file.kind === 'loading'
              ? h('p', { className: 'sm-body-note' }, t('files.loadingOne', { path: name }))
              : null,
            file?.kind === 'failed'
              ? h('p', { className: 'sm-body-note' }, t('files.readFailed', { reason: file.reason }))
              : null,
            file?.kind === 'ready'
              ? (markdown
                ? h(MarkdownFile, { text: file.text })
                // Anything else is shown verbatim: the preview must not imply it understands
                // the file, and a textarea-free `pre` keeps the bytes exactly as they are.
                : h('pre', { className: 'sm-preview-code' }, h('code', null, file.text)))
              : null,
            file?.kind === 'ready' && file.truncated
              ? h('p', { className: 'sm-body-note' }, t('files.truncated'))
              : null,
            file?.kind === 'ready'
              ? h('p', { className: 'sm-body-note' }, t('files.sizeAndLines', { size: humanSize(file.bytes), lines: file.text.split('\n').length }))
              : null)
        }

        if (tree.nodes.length === 0) {
          return h('p', { className: 'sm-body-note' }, t('files.none'))
        }
        return h(React.Fragment, null,
          h('h4', null, t('files.heading')),
          h('p', { className: 'sm-body-note' },
            t('files.treeSummaryBase', { files: tree.total, size: humanSize(tree.bytes) })
            + (detail.filesVersion !== '' ? t('files.manifestVersion', { version: detail.filesVersion }) : '')
            + t('files.treeHint')),
          h(FileTree, {
            nodes: tree.nodes,
            onOpen: (filePath) => openPreview(skill, filePath, ''),
          }))
      }

      /** Versions tab: the published history, and whether this install is behind it. */
      function versionTab(skill, detail) {
        // Same identity rule as the update button, so this tab cannot disagree with the row
        // that opened it: a favorite saved under one publisher still finds its install.
        const installedRow = installedEntryFor(skill)
        const local = String(installedRow?.version ?? '').trim()
        const latest = detail?.kind === 'ready' ? detail.latestVersion : ''
        const behind = local !== '' && latest !== '' && local !== latest
        const rows = [
          [t('versions.currentVersion'), skill.version || t('misc.notStated')],
          [t('versions.category'), skill.categoryName],
          [t('versions.source'), t(skill.source === 'official' ? 'misc.official' : 'misc.community')],
          [t('versions.identifier'), skill.canonical],
          [t('versions.firstSeen'), new Date(skill.createdAt || Date.now()).toLocaleDateString(uiLocale())],
          [t('versions.updatedAt'), t('versions.updatedAtValue', {
            date: new Date(skill.updatedAt || Date.now()).toLocaleDateString(uiLocale()),
            relative: skill.updated,
          })],
        ]
        const versions = detail?.kind === 'ready' ? detail.versions : []
        return h(React.Fragment, null,
          installedRow !== undefined
            ? h(React.Fragment, null,
              h('h4', null, t('saved.update')),
              h('div', { className: 'sm-perm' },
                h('span', { className: 'sm-perm-ic' },
                  h(Icon, { name: behind ? 'i-arrow-up-circle' : 'i-check', size: 17 })),
                h('div', { className: 'sm-perm-main' },
                  h('div', { className: 'sm-perm-title' },
                    h('strong', null, t(behind ? 'versions.newAvailable' : 'versions.upToDate')),
                    h('span', { className: 'sm-risk ' + (behind ? 'mid' : 'low') },
                      t(behind ? 'saved.updatable' : 'versions.latest'))),
                  h('div', { className: 'sm-perm-desc sm-num' },
                    t('versions.comparison', {
                      local: local || t('misc.notStated'),
                      latest: latest || t('misc.notStated'),
                    })
                    + (behind && detail?.latestChangelog ? ' · ' + detail.latestChangelog : '')))))
            : null,
          h('h4', null, t('versions.heading')),
          detail?.kind === 'loading'
            ? h('p', { className: 'sm-body-note' }, t('versions.loading'))
            : null,
          detail?.kind === 'unavailable'
            ? h('p', { className: 'sm-body-note' }, t('versions.localHasNone'))
            : null,
          versions.length > 0
            ? h(VersionHistory, {
              versions,
              installedVersion: local,
              busy: installState.kind === 'installing',
              onInstall: (version) => installVersion(skill, version),
            })
            : detail?.kind === 'ready'
              ? h('p', { className: 'sm-body-note' }, t('versions.none'))
              : null,
          h('h4', null, t('versions.versionAndSource')),
          rows.map(([label, value]) => h('div', { className: 'sm-perm', key: label },
            h('div', { className: 'sm-perm-main' },
              h('div', { className: 'sm-perm-title' }, h('strong', null, label)),
              h('div', { className: 'sm-perm-desc sm-num' }, String(value))))))
      }

      /** Permissions tab: what the skill declares, with this plugin's own access. */
      function permissionsTab(skill) {
        const rows = [
          {
            icon: 'i-globe',
            title: t('perm.network'),
            risk: 'mid',
            desc: t('perm.networkDesc', { key: t(skill.requiresApiKey ? 'perm.needsKey' : 'perm.noKeyNote') }),
          },
          {
            icon: 'i-metadata',
            title: t('perm.metadata'),
            risk: 'low',
            desc: t('perm.metadataDesc'),
          },
          {
            icon: 'i-folder',
            title: t('perm.localLibrary'),
            risk: 'low',
            desc: t('perm.localLibraryDesc'),
          },
        ]
        return h(React.Fragment, null,
          h('h4', null, t('perm.heading')),
          h('p', { className: 'sm-body-note' }, t('perm.note')),
          rows.map((row) => h('div', { className: 'sm-perm', key: row.title },
            h('span', { className: 'sm-perm-ic' }, h(Icon, { name: row.icon, size: 17 })),
            h('div', { className: 'sm-perm-main' },
              h('div', { className: 'sm-perm-title' },
                h('strong', null, row.title),
                h('span', { className: 'sm-risk ' + row.risk }, t(RISK_LABELS[row.risk]))),
              h('div', { className: 'sm-perm-desc' }, row.desc)))))
      }

      /**
       * The address to offer for a skill, from whichever source knows one.
       *
       * Both the listing and the detail response can carry it, and either may be missing. Preferring
       * the detail keeps the earlier behaviour; the important part is that whatever comes out has
       * already been through {@link publicSkillUrl}, so the tab never links to the API host.
       *
       * @param {object} skill - Skill record.
       * @param {object | undefined} detail - Cached detail, when loaded.
       * @returns {string} A URL a person can open, or ''.
       */
      function homepageFor(skill, detail) {
        const fromDetail = detail?.kind === 'ready' ? String(detail.sourceUrl ?? '') : ''
        return fromDetail !== '' ? fromDetail : String(skill.homepage ?? '')
      }

      /**
       * Safety tab: the scan verdict, and the vendors' own reports.
       *
       * Its own tab rather than a section of 指标: the verdict comes from the publisher's third-party
       * scans, while 指标 is about popularity, and folding one into the other buried the only part of
       * the drawer that says whether the thing is safe to install.
       *
       * The per-vendor links are offered only when a URL exists — a queued scan has none, and a link
       * built from nothing would be the same fault as the API-host homepage link.
       *
       * @param {object} skill - Skill record, for its id.
       * @returns {object} Element.
       */
      function safetyTab(skill) {
        const entry = securityFor(skill)
        if (entry.kind === 'loading' || entry.kind === 'idle') {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            h('p', { className: 'sm-body-note' }, t('safety.loading')))
        }
        if (entry.kind === 'failed') {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            // Stated rather than hidden: an empty section would read as "no findings".
            h('p', { className: 'sm-body-note' }, t('safety.failed', { reason: String(entry.reason ?? '') })))
        }
        const vendors = Array.isArray(entry.vendors) ? entry.vendors : []
        if (vendors.length === 0) {
          return h(React.Fragment, null,
            h('h4', null, t('safety.heading')),
            h('p', { className: 'sm-body-note' }, t('safety.none')))
        }
        const safe = entry.verdict === 'safe'
        const verdictText = t(safe
          ? 'safety.allBenign'
          : (entry.verdict === 'risk'
            ? 'safety.hasRisk'
            : (entry.verdict === 'pending' ? 'safety.pending' : 'safety.unknown')))
        return h(React.Fragment, null,
          h('h4', null, t('safety.heading')),
          h('p', { className: 'sm-body-note' }, t('safety.note')),
          // One row per vendor, each carrying its own verdict. The shield is green per row because a
          // row only exists to state what that vendor said — the single 安全 badge at the top of the
          // drawer is what requires *every* vendor to agree, and this list is where a disagreement
          // becomes visible.
          h('div', { className: 'sm-safety-vendors' },
            vendors.map((vendor) => {
              const vendorSafe = String(vendor.status) === 'benign'
              const vendorText = String(vendor.statusText || vendor.status || '—')
              return h('div', { className: 'sm-safety-vendor' + (vendorSafe ? '' : ' plain'), key: String(vendor.vendor) },
                h('span', { className: 'sm-safety-mark' },
                  h(Icon, { name: vendorSafe ? 'i-shield-check' : 'i-shield', size: 15 })),
                h('span', { className: 'sm-safety-label' },
                  h('strong', null, vendorLabel(vendor.vendor)),
                  h('span', null, vendorText)),
                typeof vendor.reportUrl === 'string' && vendor.reportUrl !== ''
                  ? h('a', {
                    className: 'sm-link-out sm-safety-report',
                    href: vendor.reportUrl,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                  }, t('safety.report'), h(Icon, { name: 'i-link', size: 12 }))
                  : null)
            })),
          // Said plainly, because the badge only appears for one verdict and its absence is otherwise
          // ambiguous between "not safe" and "not scanned".
          h('p', { className: 'sm-body-note' },
            t(safe ? 'safety.shownNote' : 'safety.hiddenNote')))
      }

      /** Metrics tab: the upstream counters, honestly labelled. */
      function metricsTab(skill, detail) {
        const homepage = homepageFor(skill, detail)
        return h(React.Fragment, null,
          h('h4', null, t('metrics.heading')),
          h('p', { className: 'sm-body-note' }, t('metrics.note')),
          h('div', { className: 'sm-stat-cards', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.downloads')),
              h('div', { className: 'sm-v' }, compact(skill.installs))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.stars')),
              h('div', { className: 'sm-v' }, compact(skill.stars))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.score')),
              h('div', { className: 'sm-v' }, formatScore(skill.score))),
            h('div', { className: 'sm-stat-card' },
              h('div', { className: 'sm-k' }, t('metrics.rating')),
              h('div', { className: 'sm-v' }, skill.rating))),
          homepage
            ? h(React.Fragment, null,
              h('h4', null, t('metrics.homepage')),
              h('p', null, h('a', {
                className: 'sm-link-out',
                href: homepage,
                target: '_blank',
                rel: 'noreferrer noopener',
              }, homepage, h(Icon, { name: 'i-link', size: 13 }))))
            : null)
      }

      /** The sliding inspector with its four tabs. */
      function inspector() {
        const skill = selectedSkill
        const open = skill !== null
        const detail = skill === null ? undefined : details[skill.id]
        const tabs = [
          ['overview', 'tab.overview'],
          ['files', 'tab.files'],
          ['versions', 'tab.versions'],
          ['permissions', 'tab.permissions'],
          ['safety', 'tab.safety'],
          ['metrics', 'tab.metrics'],
        ]
        // Named 安全扫描 rather than 安全 on purpose: the tab holds the scan's results, and a tab
        // called 安全 reads as the panel asserting the skill is safe before it has said anything.
        //
        // The shield marks it so it can be found among six, and the icon is tinted green only when
        // every vendor reported benign. The label is never tinted: a green 安全扫描 tab would make
        // the same claim as the badge, on a scan that may have failed.
        const selectedVerdict = skill === null ? 'unknown' : (securityFor(skill).verdict ?? 'unknown')
        const body = skill === null
          ? null
          : detailTab === 'files' ? filesTab(skill, detail)
            : detailTab === 'versions' ? versionTab(skill, detail)
              : detailTab === 'permissions' ? permissionsTab(skill)
                : detailTab === 'safety' ? safetyTab(skill)
                  : detailTab === 'metrics' ? metricsTab(skill, detail)
                    : overviewTab(skill, detail)
        return h(React.Fragment, null,
          h('div', {
            className: 'sm-scrim' + (open ? ' show' : ''),
            onClick: () => setSelected(null),
          }),
          h('aside', {
            className: 'sm-inspector' + (open ? ' open' : ''),
            'aria-hidden': !open,
            'aria-label': t('drawer.aria'),
          }, skill === null ? null : h(React.Fragment, null,
            h('div', { className: 'sm-insp-head' },
              h('div', { className: 'sm-insp-top' },
                h(SkillIcon, { skill, large: true }),
                h('button', {
                  type: 'button',
                  className: 'sm-icon-btn',
                  'aria-label': t('drawer.close'),
                  onClick: () => setSelected(null),
                }, h(Icon, { name: 'i-x' }))),
              h('h2', null, skill.name),
              h('div', { className: 'sm-insp-pub' },
                publisherOf(skill),
                skill.official ? h('span', { className: 'sm-verified' }, h(Verified, null)) : null,
                h('span', { className: 'sm-dot-sep' }, '·'),
                skill.categoryName),
              h('div', { className: 'sm-insp-actions' },
                installedIds.has(skill.id)
                  ? h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-secondary',
                    onClick: () => uninstall(skill),
                  }, h(Icon, { name: 'i-check', size: 16 }), t('drawer.uninstallInstalled'))
                  : h('button', {
                    type: 'button',
                    className: 'sm-btn sm-btn-primary',
                    onClick: () => install(skill),
                  }, h(Icon, { name: 'i-download', size: 16 }), t('drawer.installSkill')),
                h('button', {
                  type: 'button',
                  className: 'sm-btn sm-btn-secondary',
                  'aria-pressed': savedIds.has(skill.id),
                  onClick: () => toggleSave(skill),
                }, h(Icon, { name: 'i-bookmark', size: 16 }), t(savedIds.has(skill.id) ? 'drawer.savedState' : 'card.saveShort'))),
              h('div', { className: 'sm-insp-meta' },
                h('span', { className: 'sm-num' }, skill.version ? 'v' + skill.version : t('drawer.versionUnknown')),
                h('span', { className: 'sm-sep' }, '·'),
                h('span', null, t(skill.source === 'official' ? 'drawer.sourceOfficial' : 'drawer.sourceCommunity')),
                h('span', { className: 'sm-sep' }, '·'),
                h('span', null, t('drawer.updatedAt', { time: skill.updated }))),
            // Above the tab strip, in the drawer's fixed header rather than inside a tab's body: the
            // counters are true whichever tab is open, and inside 概览 they scrolled away with it.
            h(StatStrip, { skill }),
            h('div', { className: 'sm-tabs', role: 'tablist' },
              tabs.map(([key, label]) => h('button', {
                key,
                type: 'button',
                role: 'tab',
                className: 'sm-tab' + (detailTab === key ? ' active' : '')
                  + (key === 'safety' ? ' sm-tab-icon' : '')
                  + (key === 'safety' && selectedVerdict === 'safe' ? ' sm-tab-safe' : ''),
                'aria-selected': detailTab === key,
                onClick: () => setDetailTab(key),
              }, key === 'safety' ? h(Icon, { name: 'i-shield-check', size: 13 }) : null, t(label)))),
            // The header ends here, and the body starts as its SIBLING. Written as one nested call by mistake, the
            // body landed inside the header: measured in the running app, `.sm-insp-body` reported a parent of
            // `.sm-insp-head` (a block, row-direction box) instead of `.sm-inspector` (the column flex container).
            // With no flex parent the body was never given a height — clientHeight 5862 === scrollHeight 5862, the
            // full content height — and everything past the panel's 1352px was clipped, so the drawer could not be
            // scrolled despite `overflow-y: auto` being in force. Both closing parentheses below matter: the first
            // pair closes the header, and the run at the end closes the fragment, the aside and the outer fragment.
            ),
            h('div', { className: 'sm-insp-body' }, body))))
      }

      /* ── assembly ────────────────────────────────────────────────────── */

      const liveClass = status === 'loading' ? 'is-idle' : status === 'error' ? 'is-error' : ''
      const liveText = t(status === 'loading' ? 'status.syncing'
        : status === 'error' ? 'status.error'
          : 'status.connected')

      return h('div', { 'data-skill-market': '', 'data-skill-market-panel': PANEL_ID },
        h('header', { className: 'sm-topbar' },
          h('div', { className: 'sm-topbar-actions' },
            h('button', {
              type: 'button',
              className: 'sm-icon-btn',
              'aria-label': t('search.refresh'),
              title: t('search.refreshShort'),
              onClick: () => setReloadNonce((current) => current + 1),
            }, h(Icon, { name: 'i-refresh' })),
            h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-primary',
              onClick: onImportAction,
            }, h(Icon, { name: 'i-upload', size: 16 }), h('span', { className: 'sm-btn-label' }, t('import.pickFile'))))),

        h('div', { className: 'sm-viewbar' },
          h('div', { className: 'sm-viewtabs', role: 'tablist', 'aria-label': t('panel.aria') },
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'market' ? ' active' : ''),
              'aria-selected': view === 'market', onClick: () => goToView('market'),
            }, t('view.discover')),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'installed' ? ' active' : ''),
              'aria-selected': view === 'installed', onClick: () => goToView('installed'),
            }, t('view.installed') + ' ', h('span', { className: 'sm-vt-count' }, installed.length)),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'saved' ? ' active' : ''),
              'aria-selected': view === 'saved', onClick: () => goToView('saved'),
            }, t('view.saved') + ' ', h('span', { className: 'sm-vt-count' }, saved.length)),
            h('button', {
              type: 'button', role: 'tab', className: 'sm-viewtab' + (view === 'import' ? ' active' : ''),
              'aria-selected': view === 'import', onClick: () => goToView('import'),
            }, t('view.import') + ' ', h('span', { className: 'sm-vt-count' }, imported.length)))),

        h('div', { className: 'sm-fixed' },
          h('div', { className: 'sm-bounded' },
            view === 'installed' ? installedHead()
              : view === 'saved' ? savedHead()
                : view === 'import' ? importHead()
                  : marketHead())),

        h('main', { className: 'sm-content', ref: contentRef },
          h('div', { className: 'sm-inner sm-bounded' },
            view === 'installed' ? installedBody()
              : view === 'saved' ? savedBody()
                : view === 'import' ? importBody()
                  : marketBody())),

        h('div', { className: 'sm-statusbar' },
          h('span', { className: 'sm-live ' + liveClass }, liveText),
          h('span', { className: 'sm-num' }, t('metrics.total', { total: catalog.total.toLocaleString() })),
          h('span', { className: 'sm-spacer' }),
          h('span', null, 'SkillHub · api.skillhub.cn')),

        inspector(),

        h(ConfirmDialog, { request: confirmRequest, onClose: () => setConfirmRequest(null) }),

        h('div', { className: 'sm-toast-wrap' },
          toast === null ? null : h('div', { className: 'sm-toast' },
            h('span', null, toast.message),
            toast.undo === null ? null : h('button', {
              type: 'button',
              className: 'sm-toast-undo',
              onClick: () => { setToast(null); toast.undo() },
            }, t('toast.undo'))),

        h('input', {
          ref: fileRef,
          type: 'file',
          accept: '.zip',
          multiple: true,
          hidden: true,
          onChange: (event) => {
            addLocalFiles(event.target.files)
            event.target.value = ''
          },
        })))
    }

    /**
     * Install this panel's stylesheet and return its cleanup.
     *
     * A dynamic client bundle is a classic script: it receives `window`,
     * `document` and `require`, and nothing else — there is no `styles` free
     * global in the shipped web shell, so reaching for one throws a
     * `ReferenceError` at activation and fails the whole boot audit. The
     * supported mechanism is a `<style>` tag: the kernel's `claimStyles` /
     * `removeOwnedStyles` already inventory and evict the tags a factory
     * injects, keyed by the plugin that materialised it.
     *
     * @param {string} css - Stylesheet text.
     * @returns {() => void} Removes the tag again.
     */
    function insertStylesheet(css) {
      if (typeof document === 'undefined') return () => {}
      const tag = document.createElement('style')
      tag.textContent = css
      document.head.appendChild(tag)
      return () => { tag.remove() }
    }

    /**
     * Read the directories changed since the Harness last started.
     *
     * Changing a skill is applied on the Host immediately, but an *already open* conversation
     * keeps the tool set and skill catalog its agent was created with, so its model may not learn
     * about the change until the Harness restarts. The panel cannot restart the process — on the
     * desktop the Host is a child of the Electron shell, and `webServer` exposes no restart
     * capability — so it says so, and lets the user keep changing skills until they are done.
     *
     * That advice has to outlive a page reload, because the change is still unapplied to the
     * conversation the user is in. It must **not** outlive the restart it asks for, or the banner
     * becomes permanent — the complaint the previous build fixed by splitting the set across
     * `localStorage` and `sessionStorage`, where a fresh *window* retired it.
     *
     * The file gives a better boundary than the window ever could: the set is recorded against
     * the epoch time the running Host started (`pending.since`), and a set recorded before that
     * time is spent, because the restart it asked for has happened. A window reopened while the
     * same Host keeps running now correctly keeps advising — the change really is still unapplied
     * — and a Harness restart clears it even if the window was never closed.
     *
     * @returns {Set<string>} Directory names.
     */
    function readPending() {
      if (panelHostStartedAt > 0 && panelDocument.pending.since !== panelHostStartedAt) {
        if (panelDocument.pending.since !== 0 || panelDocument.pending.dirs.length > 0) {
          panelDocument = { ...panelDocument, pending: { since: 0, dirs: [] } }
          requestPanelFlush()
        }
        return new Set()
      }
      return new Set(panelDocument.pending.dirs)
    }

    /**
     * Persist the changed-directory set, dropping it once it is empty.
     * @param {Set<string>} pending - Directory names.
     * @returns {void}
     */
    function writePending(pending) {
      panelDocument = {
        ...panelDocument,
        pending: pending.size === 0
          ? { since: 0, dirs: [] }
          : { since: panelHostStartedAt, dirs: [...pending] },
      }
      requestPanelFlush()
    }

    /**
     * Drop a skill file's YAML frontmatter, returning just the instruction body.
     *
     * `SKILL.md` opens with `---` delimited metadata (name, description, version…) that the
     * drawer header already presents, so the overview shows only the prose. A file with no
     * frontmatter, or an unterminated one, is returned unchanged rather than emptied — a
     * truncated file must not look like an empty skill.
     *
     * @param {string} text - Raw file contents.
     * @returns {string} The body, trimmed.
     */
    function stripFrontmatter(text) {
      const source = String(text ?? '').replace(/\r\n?/g, '\n')
      if (source.startsWith('---\n') === false) return source.trim()
      const end = source.indexOf('\n---', 4)
      if (end < 0) return source.trim()
      const after = source.indexOf('\n', end + 1)
      return (after < 0 ? '' : source.slice(after + 1)).trim()
    }

    /**
     * Render a Markdown file from a skill bundle, keeping its frontmatter readable.
     *
     * A `SKILL.md` opens with a YAML block. Passing it straight to {@link Markdown} turns the
     * metadata into paragraphs, which reads as broken prose and buries the actual body. So the
     * frontmatter is lifted out and shown as a labelled monospace block — the file is being
     * *viewed*, so its metadata is part of what the user asked to see — and the body is
     * rendered as Markdown below it.
     *
     * @param {{text: string}} props - Raw file contents.
     * @returns {object} Element.
     */
    function MarkdownFile({ text }) {
      const source = String(text ?? '').replace(/\r\n?/g, '\n')
      const closed = source.startsWith('---\n') ? source.indexOf('\n---', 4) : -1
      const frontmatter = closed < 0 ? '' : source.slice(4, closed)
      const body = stripFrontmatter(source)
      return h(React.Fragment, null,
        frontmatter === ''
          ? null
          : h(React.Fragment, null,
            h('div', { className: 'sm-preview-label' }, 'Frontmatter'),
            h('pre', { className: 'sm-preview-code' }, h('code', null, frontmatter))),
        body === '' ? null : h(Markdown, { source: body }))
    }

    /**
     * The panel's own confirmation dialog.
     *
     * Exists because `window.confirm` cannot be styled and does not belong to the surrounding UI:
     * on the desktop shell it renders as a browser warning, which made a deliberate, destructive
     * action look like something going wrong. This states what will happen, shows the concrete
     * target, and keeps Escape and the scrim as ways out — the same exits people already expect.
     *
     * @param {{request: object | null, onClose: Function}} props - Pending request and dismisser.
     * @returns {object | null} Element, or null when nothing is being asked.
     */
    function ConfirmDialog({ request, onClose }) {
      const confirmRef = React.useRef(null)
      React.useEffect(() => {
        if (request === null) return undefined
        // Focus the confirming action so the dialog is keyboard-operable without a tab hunt.
        confirmRef.current?.focus()
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [request, onClose])
      if (request === null) return null
      return h('div', { className: 'sm-confirm-layer' },
        h('div', {
          className: 'sm-confirm-scrim',
          role: 'presentation',
          onClick: onClose,
        }),
        h('div', {
          className: 'sm-confirm',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-label': request.title,
        },
          h('h2', { className: 'sm-confirm-title' }, request.title),
          h('p', { className: 'sm-confirm-body' }, request.body),
          request.detail === '' ? null : h('p', { className: 'sm-confirm-detail sm-num' }, request.detail),
          h('div', { className: 'sm-confirm-actions' },
            h('button', {
              type: 'button',
              className: 'sm-btn sm-btn-secondary',
              onClick: onClose,
            }, t('action.cancel')),
            h('button', {
              ref: confirmRef,
              type: 'button',
              className: 'sm-btn ' + (request.danger === true ? 'sm-btn-danger' : 'sm-btn-primary'),
              onClick: () => {
                // Close first: the action can navigate or clear the subject it refers to.
                onClose()
                request.onConfirm()
              },
            }, request.confirmLabel))))
    }

    /**
     * The address a person can open for a skill.
     *
     * Upstream's `homepage` field points at the **API** host — `https://api.skillhub.cn/<ns>/<slug>` —
     * and that host answers a browser request with `405 Method Not Allowed`: it serves the JSON API,
     * not pages. Putting it in the 指标 tab gave a link that could not work.
     *
     * Measured behaviour of the alternatives for `<ns>/<slug>` = `indiv-ebandao/dev-expert`:
     *
     *   api.skillhub.cn/<ns>/<slug>          405, no body
     *   skillhub.cn/<ns>/<slug>              200, but the generic SPA shell (7 KB, no skill data)
     *   skillhub.cn/skills/<ns>/<slug>       200, 48 KB, `og:title` = the skill's own name
     *
     * So the public route is `/skills/` + namespace + slug, built from the identifiers rather than
     * from the field: `homepage` is only trusted for the case where it names some other host the
     * publisher chose, which must be left exactly as given.
     *
     * @param {unknown} homepage - Upstream's own value, if any.
     * @param {string} handle - Namespace/handle from the listing.
     * @param {string} slug - Skill slug.
     * @returns {string} A URL to open, or '' when there is nothing to point at.
     */
    function publicSkillUrl(homepage, handle, slug) {
      const raw = typeof homepage === 'string' ? homepage.trim() : ''
      const namespace = String(handle ?? '').trim()
      const name = String(slug ?? '').trim()
      // A URL on the API host is the upstream bug being corrected; anything else is a real choice.
      if (raw === '' || raw.includes('//api.skillhub.cn')) {
        if (namespace === '' || name === '') return ''
        return `https://skillhub.cn/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
      }
      return raw
    }

    /**
     * The 「安全」 badge, shown only when the badge is something upstream actually said.
     *
     * The verdict comes from the Host, which requires **every** vendor to report `benign`. That
     * matters: vendors disagree in practice (`ima-skills` is benign from one and suspicious from the
     * other), so a badge drawn from "at least one said safe" would be a claim nobody made. Nothing is
     * rendered for any other verdict — no grey "unknown" chip either, because an absence says
     * "not scanned" honestly and a chip would imply the panel had an opinion.
     *
     * @param {{verdict: string, compact: boolean}} props - Verdict and whether to show the word.
     * @returns {object | null} Element, or null when there is no 安全 to report.
     */
    function SafetyBadge({ verdict, compact }) {
      if (verdict !== 'safe') return null
      return h('span', {
        className: 'sm-safety' + (compact ? ' sm-safety-compact' : ''),
        title: t('safety.badgeTitle'),
      },
        h(Icon, { name: 'i-shield-check', size: compact ? 13 : 15 }),
        compact ? null : t('safety.badge'))
    }

    /**
     * Display names for the security vendors, by the code upstream uses.
     *
     * Measured, not guessed: **every** one of 240 skills sampled across 12 pages reports exactly these
     * two codes — `keen` and `sanbu` — so the set really is fixed, and a lookup is honest rather than
     * a hopeful guess at a shape that keeps changing. The names were confirmed from the vendors' own
     * reports: `keen`'s link lands on 科恩实验室's threat-intelligence site (tix.qq.com), and `sanbu`'s
     * report HTML carries 云鼎实验室 in its own markup.
     *
     * An unrecognised code is still rendered, under the code itself — a future vendor must show up
     * rather than be dropped, because dropping it would narrow the scan and silently strengthen the
     * 安全 badge.
     * @see scripts/dev/security-vendors.mjs
     */
    const VENDOR_NAMES = { keen: 'misc.vendorKeen', sanbu: 'misc.vendorSanbu' }

    /**
     * The name to show for a vendor code.
     *
     * The table holds dictionary keys and the translation happens here. An earlier revision stored the keys in
     * the table and returned them untranslated, which printed `misc.vendorKeen` on screen in every language —
     * the table's values are keys, so they must be resolved at the point of use.
     *
     * @param {unknown} vendor - Upstream's code.
     * @returns {string} Localised vendor name, or the code as given when it is unrecognised.
     */
    function vendorLabel(vendor) {
      const code = String(vendor ?? '')
      const key = VENDOR_NAMES[code]
      return key === undefined ? code : t(key)
    }

    /**
     * The counter strip in the drawer header: downloads, favorites, score, version.
     *
     * Above the tab strip rather than inside a tab. It began as the drawer's footer, below the tab body,
     * where it read as a trailing summary of a page already scrolled; inside 概览 it scrolled away with
     * that tab. In the header it is simply present, whichever tab is open.
     *
     * @param {object} skill - Skill record.
     * @returns {object} Element.
     */
    function StatStrip({ skill }) {
      return h('div', { className: 'sm-stat-strip' },
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, compact(skill.installs)),
          h('span', null, t('metrics.downloads'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, compact(skill.stars)),
          h('span', null, t('card.saved'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, formatScore(skill.score)),
          h('span', null, t('metrics.score'))),
        h('div', { className: 'sm-f' },
          h('strong', { className: 'sm-num' }, skill.version || '—'),
          h('span', null, t('card.version'))))
    }

    /**
     * Human-readable byte count for imported packages.
     * @param {number} bytes - File size.
     * @returns {string} Label.
     */
    function humanSize(bytes) {
      const n = Number(bytes)
      if (!Number.isFinite(n) || n <= 0) return t('files.unknownSize')
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1024 / 1024).toFixed(1) + ' MB'
    }

    /**
     * The sidebar entry glyph, drawn at the size the sidebar asks for.
     * @param {object} props - `size` from the sidebar.
     * @returns {object} Element.
     */
    function PanelIcon({ size }) {
      return h(Icon, { name: 'i-grid', size: size ?? 18 })
    }

    return {
      name: NS,
      // `locale` is optional in practice: `apply` guards its absence, and the panel then renders the
      // shipped Chinese text. Declaring it makes the service available when the build provides one.
      inject: ['slots', 'locale'],
      /**
       * Exposed for the test harness only: the relative-time formatter.
       *
       * It is the function whose "0 means 1970" behaviour produced "安装于 57 年前", and the
       * rule it now follows — an unusable timestamp yields no label rather than a wrong one —
       * is worth asserting directly instead of inferring from a rendered row.
       *
       * @param {number} timestamp - Epoch milliseconds.
       * @returns {string} Relative label, or '' when unknown.
       */
      relativeTimeForTest: (timestamp) => relativeTime(timestamp),
      /**
       * Exposed for the test harness only: the translator.
       *
       * Asserted under the real Cordis runtime with a locale service present, because the interesting
       * behaviour — using the injected service, and falling back to the shipped dictionary when the
       * service answers with the key — cannot be observed from the rendered output of a stub harness.
       *
       * @param {string} key - Dictionary key.
       * @param {object} [params] - Placeholder values.
       * @returns {string} Translated text.
       */
      tForTest: (key, params) => t(key, params),
      /**
       * Contribute the panel and its sidebar entry.
       * @param {object} ctx - Client plugin context.
       * @returns {void}
       */
      apply(ctx) {
        ctx.effect(() => insertStylesheet(CSS), '@montersy123/dsh-skill-market: stylesheet')

        /**
         * Read the stored document as soon as the client activates, not when the panel mounts.
         *
         * The panel is opened from the sidebar long after boot in practice, so starting here makes
         * the document available before the first render — which is what lets `readState()` stay
         * synchronous. The promise is also what the panel's reconciliation waits on, and it never
         * rejects: a Host that cannot answer leaves a working panel with no persistence rather
         * than a plugin that fails to activate.
         */
        void panelStateReady()

        /**
         * Adopt the DSH locale service, if this build has one.
         *
         * Guarded rather than assumed: the panel must still render when the client locale package is
         * absent (a harness, or a leaner Host build), and it degrades to the shipped Chinese text
         * instead of failing to mount. `bind` resolves against the service's snapshot when *called*,
         * so one binding keeps working across a language switch; `subscribe` is only needed to keep
         * `clientActive` — which decides the dictionary used when the service has no entry — in step.
         */
        if (ctx.locale !== undefined && ctx.locale !== null) {
          /**
           * Register the dictionaries with the service.
           *
           * This is what the shipped panels do, and it is not merely a fallback for `bind`: registering
           * advances the locale snapshot's monotonic revision, and that revision is what the slot system's
           * injected `t` seat and the sidebar's panel list observe. Without a registration the service knows
           * nothing about this namespace, so a language switch has nothing to announce and the sidebar entry
           * — whose `label` is a function collected at registration — is never re-evaluated.
           *
           * Registered as an owned effect so unloading the plugin also withdraws the dictionaries.
           */
          try {
            ctx.effect(
              () => ctx.locale.register(CLIENT_NS, { zh: ZH, en: EN }),
              '@montersy123/dsh-skill-market: locale dictionaries',
            )
          } catch {
            /* a service without `register` still works through `bind` and the shipped tables */
          }
          clientLocale = ctx.locale.bind(CLIENT_NS)
          const syncActive = (snapshot) => {
            const active = String(snapshot?.active ?? '')
            clientActive = active.toLowerCase().startsWith('en') ? 'en' : 'zh'
          }
          try {
            syncActive(ctx.locale.getSnapshot?.())
            const unsubscribe = ctx.locale.subscribe?.(() => { syncActive(ctx.locale.getSnapshot?.()) })
            if (typeof unsubscribe === 'function') {
              ctx.effect(() => unsubscribe, '@montersy123/dsh-skill-market: locale subscription')
            }
          } catch {
            /* an unexpected service shape must not stop the panel from mounting */
          }
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, SkillMarketPanel))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => t('panel.title'),
          locale: NS,
        }, PanelIcon))
      },
    }
  },
})
