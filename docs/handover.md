# 交接文档（2026-10-19）

给下一次对话用的状态快照：现在在哪、已经做了什么、还剩什么问题、怎么继续。

---

## 1. 一句话现状

- 仓库：`D:\DshProjects\dsh-skill-market`，分支 `main`，最新提交 `release: v2.0.6`。
- 已发布：`@montersy123/dsh-skill-market@2.0.6`（npm `latest`，provenance 已上传，17 files，
  shasum `d1816e0a…`），tag `v2.0.6`，[Release](https://github.com/montersy123/dsh-skill-market/releases/tag/v2.0.6)；
  上一版 `2.0.5` 的 CI 是 [publish #39212483636](https://github.com/montersy123/dsh-skill-market/actions/runs/39212483636)。
- 全部检查通过：`npm test` **34/34**；渲染断言 `scripts/verify-render.mjs` **57 条**。
- **唯一未解决的产品问题**：表格单元格里「链接 + 纯文本」混合时，链接在面板里不显示为链接（详见第 6 节）。
- **2.0.6 修掉了数据丢失**：读不到 `panel.json` 不再被当成“空文档”（见第 10 节）。本机 profile 里的 `lib/`
  已是最新代码（`INSTALLED COPY OK`），但 profile 的 `package.json` 仍写 `2.0.5`；下次
  `dsh plugin add @montersy123/dsh-skill-market@2.0.6` 会一并对齐（需要时先把 `2.0.6` 加进
  `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`，因为发布不足 24 小时）。

## 10. 数据丢失事故（2026-10-19，务必读）

**症状**：用户发现自己收藏夹空了，`panel.json` 的 `saved: []`、`savedSkills: {}`。

**根因（已修）**：`readPanelState()` 把「文件不存在」和「读失败/不是合法 JSON」都返回 `null`；
`GET /state` 于是回 `200 {state: null}`；面板把它当成“从未存过”，采纳空默认值，mount 后的派生状态一写回，
就把真文档覆盖成空文档。Windows 上文件被占用（rename 重试窗口、杀软扫描）很容易触发一次读失败。

**修复（`f3914f7`）**：
1. `readPanelState()` 只有 **ENOENT** 才返回 `null`，其它一律抛错；`GET /state` 报 **5xx**，面板据此
   **不写盘**（`panelPersistenceBlocked`），保留内存副本，等下次成功读取再恢复持久化；
2. `writePanelState()` 在替换前把旧文档复制成 `panel.json.bak`（尽力而为），一次坏写只损失一次变更；
3. `scripts/panel-live-check.mjs` 增加两条回归：损坏文件 → 5xx 且应答里没有可采纳的文档；写入后 `.bak` 存在且完整。

**恢复**：旧收藏**没有任何副本可恢复**（已搜过 `~/.dsh` 下所有 `panel.json`、以及 Electron 的 localStorage，
均无）。只能手工重新收藏。今后若再丢，先看同目录的 `panel.json.bak`。

**教训**：排查期间反复让用户「刷新页面」会放大这个竞态。以后让用户刷新前，先确认“读失败不会导致写覆盖”这类
不变量。


## 2. 环境与路径（每次都会用到）

| 项 | 值 / 说明 |
|---|---|
| 仓库 | `D:\DshProjects\dsh-skill-market` |
| 插件安装位置 | `%USERPROFILE%\.dsh\profiles\desktop\node_modules\@montersy123\dsh-skill-market` |
| 数据目录 | `%USERPROFILE%\.dsh\storages\@montersy123\dsh-skill-market\data`（`panel.json` / `installed.json` / `skills/`） |
| PATH 里的 node | **v16.13.1，不能用** |
| 可用的 node | `C:\Users\zyh33\AppData\Local\Author Software\nvm\installs\v26.9.0\node.exe`；命令前加 `$env:PATH = 'C:\Users\zyh33\AppData\Local\Author Software\nvm\installs\v26.9.0;' + $env:PATH` |
| npm | 用 `npm.cmd`（`npm.ps1` 被执行策略拦） |
| git 推送 | 全局代理 `http.proxy=https://127.0.0.1:7897` 时好时坏；直连常报 `Recv failure: Connection was reset`，多试一次或 `git push origin main`（走代理）即可 |
| GUI 端口 | **每个会话都变**（最近见 3820 / 2932 / 11514 / 5278…），以运行时上下文里的 URL 为准 |
| 改完客户端怎么生效 | 客户端插件是**整包**加载的：改 `lib/client.js` 后**刷新页面**；改 `lib/index.js` 要**重启 App** |
| 本地验证运行版本 | `GET http://127.0.0.1:<端口>/skill-market/api/build` → `{hostBuild, version, client:{bytes,mtime,sha256,hasBuildMarker}}` |
| profile 副本同步（手动覆盖） | `Copy-Item lib\client.js,lib\index.js,lib\locale.js <安装位置>\lib\ -Force`，然后 `node scripts/installed-copy-check.mjs` 应输出 `INSTALLED COPY OK` |

## 3. 架构速览

- **Host 半** `lib/index.js`：`apply(ctx)` 里 `ctx.webServer.register({ kind:'prefix', path:'/skill-market/api' })`，
  负责代理 `api.skillhub.cn`、安装/卸载/停用技能（`ctx.skills.register` 运行时注册）、写数据目录。
  `UPSTREAM` 在文件顶部（只有一个地址）；`STORAGE_SEGMENTS = ['@montersy123','dsh-skill-market']`。
- **Client 半** `lib/client.js`：`window.__ModuleLoader__.load({ id, factory(require) })`，一个工厂闭包，
  内含 `SkillMarketPanel`（主面板）、`inspector()`（右侧抽屉，六个页签）、`FileDialog`（文件弹框）、
  `Markdown`（面板自带的小渲染器，**现在只在宿主渲染器缺失时使用**）。
- **字典**：`lib/locale.js` 是唯一来源；`node scripts/inline-client-locale.mjs` 把中英两份内联进
  `lib/client.js` 的生成块（`--check` 校验）。改文案只改 `lib/locale.js`，然后重新生成。
- **状态**：`panel.json`（收藏/已装账本/类目偏好，整份文档一次读写）。
- **文件预览缓存键**：`previewKey(skill, path, version)` = `` `${skill.id}|${version}:${path}` ``，
  必须带技能 id（`SKILL.md` + 最新版是所有技能共用的键）。

## 4. 2.0.5 交付了什么（与 CHANGELOG 一致）

1. **文件内容改用弹框**：`.sm-preview-layer`（z-index 58，覆盖整个面板）> 抽屉（40）< 确认框（60）；
   弹框 1040×760，≤920px 变整屏；关闭按钮 / 遮罩 / `Esc` 三个出口，`Esc` 只关弹框。
2. **文档内相对链接可点**：`resolveBundlePath(baseFile, href)` 解析（支持 `./` `../`，拒绝绝对路径/URL/越界），
   目标必须在 `/files` 清单里；点开在同一弹框切换，`previewTrail` 支持「返回上一个文件」。
3. **代码文件语法高亮**：用宿主 `useCodeHighlighter(lang)`（**不是** `CodeBlock`），语言由 `CODE_LANGUAGES`
   按扩展名推断；配色是面板自己的 `--shiki-*`（浅色更深、深色更亮）。
4. **只读接口 `GET /skill-market/api/build`**：返回 host/client 构建指纹（用来判断“页面是不是旧版本”）。

## 5. 关键实现点与踩过的坑（重要，避免重犯）

1. **markdown 一律由宿主渲染**（`primitives.MarkdownText`）。面板**不要**覆盖宿主的 markdown 排版/链接颜色：
   曾经加过 `[class*="markdown"] h1…code…` 与 `[class*="fileLink"]` 一堆覆盖，结果与 DSH 自己的文件视图
   不一致，还把宿主给的链接颜色盖掉。现在只保留一条：
   `[data-skill-market] [class*="markdown"] svg { display: inline-block }`（因为面板全局有
   `svg { display: block }`，不加会让链接里的图标独占一行）。
2. **不要写宿主的 hash 类名**：宿主的类是 CSS Modules 产物（`_markdown_1ypvv_5`、`_fileLink_1ypvv_59`），
   随构建变化。要选就用属性子串（`[class*="fileLink"]`），但更稳的是**结构**（如 `.sm-preview-body button`）。
3. **代码高亮不要用 `CodeBlock`**：它把“请求语法包”挂在自己的 IntersectionObserver（`g8`）上，弹框里那个块
   常常不被判定可见 → 语法包永不加载 → 首屏不亮、跳转一次后才亮。`useCodeHighlighter` 走 `l8`（内部 `Hc`
   确保加载并订阅完成事件），语法到达后自己重渲染。
4. **`HostFallback`（错误边界）的失败状态要随 `resetKey` 清除**：宿主在语法/样式未就绪时抛一次错，
   不能让边界永久停在兜底分支。
5. **`Esc` 的处理要让位**：弹框打开时抽屉的 `Esc` 必须失效，否则一按就关掉整层。
6. **客户端整包加载**：改完 `lib/client.js` 必须刷新页面；Web GUI 端口每个会话会变。
   排查“改了没反应”先查 `/build` 的 `client.sha256`，再判断是不是旧 bundle。
7. **文件写盘不要去碰 `Get-Content/Set-Content`**：仓库是 UTF-8 无 BOM、`eol=lf`；PowerShell 的 `>` 会写
   UTF-16。需要写文件时用 `[IO.File]::WriteAllText($p, $text, (New-Object Text.UTF8Encoding($false)))`。
8. **`git add` 用显式路径**（`git add lib/client.js ...`），不要 `git add -A scripts`：`scripts/dev/` 下有
   4 个未纳入版本库的临时脚本，曾两次被误提交。
9. **CSS 模板字符串里不能出现反引号**（`lib/client.js` 的样式是一段模板字符串），注释里写
   `` `<button>` `` 会直接把字符串截断。多次踩到。

## 6. 未解决的问题：表格单元格里「链接 + 纯文本」不渲染

**现象**（用户最后确认）：只有 `SKILL.md` 的首选资料表格里那种「链接文字前面或后面还有纯文字」的单元格
不显示链接；其它文件里的链接正常。

**已确认的事实**（别再重复验证这些）：

- `/build` 报告 `hostBuild: b21`，client 的 `sha256` 与磁盘一致 → 页面跑的是新代码；
- 面板挂载时上报过 `hasMarkdown: true, hasDelegateProvider: true, hasHighlighter: true`，
  `rendererExports` 含 `MarkdownDelegateProvider` / `MarkdownText` / `useCodeHighlighter`
  → **宿主给了链接能力**，“provider 缺失导致链接只能是纯文本”这条不成立；
- 表格本身能渲染（`div.md-table-scroll > table`），行内代码 chip 正常；
- 面板**没有任何**对宿主 markdown 的样式覆盖（只剩那条 `svg` inline 规则）。

**可疑方向（下一步从这里入手）**：

1. **混合单元格的图标/链接节点是否真的生成**：临时加一个诊断（代码见下），把某个 `td` 的 `innerHTML`
   打出来 —— 里面是 `<button class="_fileLink_…">`，还是纯文本？这决定是“宿主没生成元素”还是“生成了但没样式”。
2. 如果是纯文本：怀疑宿主的表格单元格渲染路径（`X3` → `qt(cell.children, ctx)`）在遇到
   `[text, link, text]` 混合 children 时丢掉了 link 节点；也可能与 `md-table-wide`（≥4 列）分支有关。
3. 如果是 `<button>` 但没颜色：宿主 CSS 对 `._fileLink_…` 的颜色选择器可能带父级限定（例如只在会话容器内
   生效），需要针对该元素加一条**结构性**规则（`.sm-preview-body button { color: … }` 或经 `style.setProperty`
   写行内色），不要写 hash 类名。

**诊断代码骨架（临时用，用完删）**：

```js
// host: lib/index.js，在 POST 分支里
if (suffix === '/client-report') {
  const body = await readJsonBody(req, 8192)
  await mkdir(pluginDataRoot(), { recursive: true })
  await writeFile(join(pluginDataRoot(), 'client-report.json'), JSON.stringify(body, null, 2), 'utf8')
  sendJson(res, 200, { ok: true })
  return
}

// client: 弹框渲染后（FileDialog 内）
const body = bodyRef.current
const table = body.querySelector('table')
reportToHost({
  path: preview.path,
  cellButtons: table.querySelectorAll('td button').length,
  cellAnchors: table.querySelectorAll('td a').length,
  cells: Array.from(table.querySelectorAll('td')).slice(0, 4).map((td) => td.innerHTML.slice(0, 260)),
})
```

报告落在 `%USERPROFILE%\.dsh\storages\@montersy123\dsh-skill-market\data\client-report.json`。

**注意**：曾尝试“面板自己渲染 markdown”来绕开这个问题，被用户否掉了（改动面太大）；也尝试过隐藏链接里的
类型图标、强制链接颜色，用户不希望面板自作主张改宿主的呈现。所以这条只应在**确认原因**后再做最小修复。

## 7. 常用命令

```powershell
# 前置：把 PATH 指向可用的 node
$env:PATH = 'C:\Users\zyh33\AppData\Local\Author Software\nvm\installs\v26.9.0;' + $env:PATH

node scripts/run-checks.mjs          # 全量 34 项，必须全绿（CI 也会跑 publish-check）
node scripts/verify-render.mjs       # jsdom 渲染断言（57 条）
node scripts/build-fingerprint-check.mjs
node scripts/inline-client-locale.mjs        # 改过 lib/locale.js 后重新生成内联块
node scripts/inline-client-locale.mjs --check
node scripts/publish-check.mjs               # 打包前必跑，期望 PUBLISH READY
node scripts/installed-copy-check.mjs        # 本地 profile 副本是否与源一致
node scripts/install-plugin.mjs --apply      # 把仓库装进 profile（会走 pnpm）
```

发布流程（不要手改 npm）：

```bash
# 1) 改 package.json + CHANGELOG，提交：`release: vX.Y.Z`（只碰这两个文件）
# 2) 打 annotated tag 并推送，CI（.github/workflows/publish.yml）用 OIDC 发布
git tag -a vX.Y.Z -m "vX.Y.Z"
git -c http.proxy= -c https.proxy= push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes.md>
# 3) 确认：gh run watch <run-id>，然后 npm view @montersy123/dsh-skill-market@X.Y.Z version
#    发布后 npm 会显示 “being processed”，约 1 分钟后才能查到
```

## 8. 下次开会话时的开场建议

把这段直接贴给新会话：

> 继续 `D:\DshProjects\dsh-skill-market`（v2.0.5 已发布）。先读 `docs/handover.md`。
> 现在只剩一个问题：表格单元格里「链接 + 纯文本」混合时链接不渲染；宿主 `MarkdownDelegateProvider`
> 是存在的，面板也没有覆盖宿主样式。下一步是加临时诊断确认那个 `td` 的 `innerHTML` 里到底有没有
> `<button>`。环境注意：PATH 里的 node 是 v16 不能用，要用 nvm 的 v26；客户端改完要刷新页面；
> 排查版本用 `GET /skill-market/api/build`。

## 9. 其它备忘

- 发布过的版本：`2.0.1` … `2.0.5`；每次发布都只动 `package.json` + `CHANGELOG.md` 的 release 提交。
- `files` 白名单：`lib` / `locale` / `assets` / `icon.svg` / `cordis.patch.yml` / `screenshots.json` /
  `README*.md` / `THIRD-PARTY-NOTICES.md` —— `docs/` 与 `scripts/` **不会**进包，本文件也不会。
- 上游市场：dshmarket 的目录里已提交过本插件的 PR（#6632，仍在排队），与代码问题无关。
- 面板侧 `BUILD` / host 侧 `HOST_BUILD` 两个常量只是构建标记（当前都是 `b21`），用于 `/build` 判断版本；
  改代码时不必同步升级，除非需要区分构建。
