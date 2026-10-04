/**
 * Batch 6 — the toasts around enabling, installing, uninstalling and importing.
 *
 * Every one of these was built by concatenating Chinese fragments around a runtime value. They become
 * single keys with placeholders: the fragments cannot be translated separately, because a sentence's
 * word order and punctuation are not a property of its parts.
 */
export default [
  // Enable / disable.
  ["          notify(next ? '已启用「' + skill.name + '」，重启 DeepSeek Harness 后生效' : '已停用「' + skill.name + '」，重启 DeepSeek Harness 后生效')",
    "          notify(t(next ? 'action.enableRestart' : 'action.disableRestart', { name: skill.name }))"],
  ["          notify('切换「' + skill.name + '」失败：' + reason)",
    "          notify(t('action.toggleFailed', { name: skill.name, reason }))"],

  // Install progress and outcomes.
  ["        notify(version === ''\n          ? '正在安装「' + skill.name + '」…'\n          : '正在安装「' + skill.name + '」v' + version + '…')",
    "        notify(t(version === '' ? 'action.installingNamed' : 'action.installingVersion', { name: skill.name, version }))"],
  ["            throw new Error('Host 未返回安装结果')", "            throw new Error(t('action.noInstallResult'))"],
  ["          notify(becameEnabled\n            ? `已安装「${skill.name}」v${installedVersion}：${result.files} 个文件 → ${result.directory}，重启 DeepSeek Harness 后生效`\n            : `已更新「${skill.name}」v${installedVersion}：${result.files} 个文件已写入停用目录，技能仍处于停用状态`)",
    "          notify(becameEnabled\n            ? t('action.installedDetail', { name: skill.name, version: installedVersion, files: result.files, directory: result.directory })\n            : t('action.updatedParked', { name: skill.name, version: installedVersion, files: result.files }))"],
  ["          notify('安装「' + skill.name + '」失败：' + reason)",
    "          notify(t('action.installFailed', { name: skill.name, reason }))"],

  // Uninstall.
  ["            notify('卸载「' + skill.name + '」失败：' + reason)",
    "            notify(t('action.uninstallFailed', { name: skill.name, reason }))"],
  ["        notify(answer?.uninstall?.wasDisabled === true\n          ? `已从停用目录移除「${skill.name}」，重启 DeepSeek Harness 后生效`\n          : `已卸载「${skill.name}」，重启 DeepSeek Harness 后生效`)",
    "        notify(t(answer?.uninstall?.wasDisabled === true ? 'action.removeFromDisabled' : 'action.uninstalledRestart', { name: skill.name }))"],

  // The confirmation dialog's own copy.
  ["          title: `卸载「${skill.name}」？`,", "          title: t('action.uninstalling', { name: skill.name }),"],
  ["          body: '技能目录会从磁盘删除，已停用的技能也会一并移除，卸载后需要重新下载才能恢复。',",
    "          body: t('action.uninstallBody'),"],
  ["          confirmLabel: '卸载',", "          confirmLabel: t('action.uninstall'),"],

  // Version downgrade confirmation.
  ["            title: `回退「${skill.name}」到 v${version}？`,", "            title: t('action.downgrade', { name: skill.name, version }),"],
  ["            body: `当前安装的是 v${currentVersion}。技能目录会被替换为该旧版本的完整文件。`,",
    "            body: t('action.downgradeBody', { current: currentVersion }),"],
  ["            confirmLabel: '回退',", "            confirmLabel: t('action.downgradeConfirm'),"],
  ["            }, '取消'),", "            }, t('action.cancel')),"],

  // Detail loading.
  ["          if (options.quiet !== true) notify('详情加载失败：' + (error instanceof Error ? error.message : String(error)))",
    "          if (options.quiet !== true) notify(t('action.detailFailed', { reason: error instanceof Error ? error.message : String(error) }))"],
]
