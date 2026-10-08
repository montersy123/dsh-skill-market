# dsh-skill-market · 开发笔记

**语言 / Language:** 中文 · [English](../README.en.md)

**这一份面向维护者与贡献者,记录设计契约与踩过的坑。** 想安装和使用这个插件,请看 [README](../README.md)。

插件本身把设计原型落成 DeepSeek Harness 里的一个面板:浏览、筛选、搜索、查看详情,并把技能**真的下载安装到本机**。
数据来自 **SkillHub**(<https://skillhub.cn/skills?sortBy=score>)。

## 技能要生效，需要三层都在

这是最容易踩的地方，也是这个插件返工最多的地方。**「注册进注册表」不等于「模型看得到」**：

| 层 | 谁负责 | 缺了会怎样 |
|---|---|---|
| ① 注册表 | `@deepseek-ai/dsh-skill` | 没有 `ctx.skills`，什么都注册不了 |
| ② 发布者 | 本插件（`register(...)`）+ `@deepseek-ai/dsh-skill-filesystem`（扫 `$DSH_HOME/skills`） | 技能在磁盘上，但注册表里没有，模型看不到 |
| ③ 消费者（渲染目录 + `skill` 工具） | **`@deepseek-ai/dsh-tool-skill`** | **注册表里有，模型照样看不到** |

`dsh-tool-skill` 的官方文档原话：

> without it, providers and the registry still work, but **nothing renders a catalog or a tool for the model**.

所以本插件的安装流程**依赖 ③ 已启用**。`desktop` profile 里三层现状：

```jsonc
"@deepseek-ai/dsh-skill"            // enabled（默认开）
"@deepseek-ai/dsh-skill-filesystem" // 本插件安装时一并启用
"@deepseek-ai/dsh-tool-skill"       // 本插件安装时一并启用（关键，之前是关的）
```

本插件**仍保留自己的 runtime 注册**（第 ② 层），原因见下文「为什么是 register 而不是 provider」。

## 「安装」到底做了什么

点「安装」是一次**真实的落盘操作 + 活的注册**，不是本地标记：

1. Client 半 `POST /skill-market/api/install`，带上 `slug` / `namespace`。
2. Host 半拉取该技能的文件清单（`/api/v1/skills/<slug>/files`），校验：
   路径必须落在技能目录内、文件数 ≤ 2000、单文件 ≤ 8 MB、整包 ≤ 64 MB、
   **每个文件的 sha256 必须与清单一致**、必须含 `SKILL.md`。
3. 全部下载到 `<目录>.installing`，成功后换成正式目录（先删旧目录、带重试的 rename，
   因为 Windows 上目录被占用时 rename 会 EPERM）。中途失败不会留下半个技能。
4. Host 半用 `ctx.skills.register(...)` 把它**注册进运行中的会话**，
   于是**装完即可调用，不用重启**；面板的启用开关映射到 register / disposer。

### 为什么是 register 而不是 provider

这是这次返工的核心。`ctx.skills` 有两条发布路径，看起来等价，实际完全不同：

| 机制 | 何时生效 | 启停 |
|---|---|---|
| `registerProvider(...)` | **只有当某个东西调用它的 `invalidate()` 时**才重新读目录。在没有挂载文件监听型技能插件的 profile 里，**没有任何东西会调它** —— 于是新装的技能要等到下次进程启动才可见 | provider 无启停概念，只能靠重新 list |
| `register(...)` | 立即，对下一个 model step 可见 | 返回 own disposer，**注册即启用、dispose 即停用** |

所以本插件用 `register(...)`：安装 → 注册、启用 → 注册、停用 → dispose。

### 停用 = 把目录移出 `skills\`

只 dispose 注册**不够**：文件还在 `$DSH_HOME/skills` 里，而已启用的内置
`dsh-skill-filesystem` 会继续把同一个技能扫出来 —— 开关看着生效了，技能却还在。
所以停用会把**整个目录移动**到：

```
%USERPROFILE%\.dsh\skill-market\disabled\<handle>--<slug>\
```

启用时再移回来。于是「**位置就是状态**」：

| 目录位置 | 含义 |
|---|---|
| `$DSH_HOME\skills\<name>` | 已启用；对 Harness 和任何其它 provider 都可见 |
| `$DSH_HOME\skill-market\disabled\<name>` | 已停用；**任何人**都扫描不到，包括内置文件系统提供方 |

这样两条路径不可能互相矛盾（旧版把决定写在 `state.json` 里、文件却留在原地，
就是会矛盾）。移动是 rename，所以在 Windows 上比「覆盖被占用的目录」更可靠；
失败会带重试并保留原状，不会留下半个技能。启用中的技能被卸载时会从两个位置找。

升级说明：如果你用的是旧版（`state.json` 记停用、文件留在 `skills\`），
插件启动时会读那份 state 并把列出的技能搬进 `disabled\`，然后删掉 state 文件。

> 顺带一个反直觉的点：`register()` 只给 `invocation` 和 `provider` 兜底，
> **不给 `source` 兜底**；而 `validateDefinition` 会在 `get()` 时要求 `source` 是字符串。
> 所以注册时 `source` 必须显式传。这类字段缺失是「整份技能目录一起消失」级别的事故，
> `../scripts/skills-provider-check.mjs` 用真实注册表把这些字段全测住了。

安装位置（Harness 自带的本地技能根目录，**没有额外的插件目录层**）：

```
%USERPROFILE%\.dsh\skills\<handle>--<slug>\
    ├─ SKILL.md
    ├─ references/
    ├─ scripts/
    └─ …（上游完整目录结构）
```

会话里的调用名取 `SKILL.md` 的 frontmatter `name`（必须 kebab-case），
目录名用 `<handle>--<slug>`（发布者+slug 唯一，中文显示名改不动它）。
「已安装」行的提示只显示「v… · 发布者 · 下载 · 安装于…」与「skill 目录：<路径>」——
**不再显示「调用 /<name>」**（按需求移除；两者不同时那个名字仍然决定会话里的调用方式，
但它属于实现细节，放在提示里只是噪音）。本地导入的技能没有发布者与下载数，那一行显示
「v… · 本地导入」，不会出现读起来像真实数据的「0 下载」。

**为什么用 Harness 自带的技能根目录**：这就是 `dsh-skill-filesystem` 的
`user-dsh` 根（rank 400）。放在这里，装完的技能就是**普通本地技能** ——
内置文件系统提供方（若启用）能找到它、Skills 界面把它和手写技能列在一起、
禁用本插件也不会让它消失。本插件另外用 `register(...)` 做一次**运行时注册**兜底，
保证即使没启用文件系统提供方，装完也能立刻在会话里用。

早期版本写到 `$DSH_HOME/skill-market/skills`，那个位置现在没有东西会发现，
所以插件启动时会把里面已有的技能**搬到现在这个根目录**并删掉空壳目录。

「卸载」会调 `POST /skill-market/api/uninstall`，在 `skills\` 和 `disabled\`
两处查找并删除。**注意技能包里的 `scripts/`、`hooks/` 是上游作者提供的可执行文件**，
安装后 Harness 只是把它当技能说明加载；是否运行里面的脚本由你决定，
安装本身不会执行任何上游代码。

## 详情抽屉

详情是**按需从 SkillHub 取的**，列表卡片带不了这些 —— 所以**没有「同步详情」这个动作**。
`/installed` 的答复里带上了发布者与 slug（从目录名 `<publisher>--<slug>` 推导），于是
**冷启动也能打开详情**，包括本地从未浏览过的技能。

**只有 `market` 来源才有详情页**：`local`（面板导入）与 `manual`（手工放置）的「详情」按钮不渲染，
点行本身也不会打开 —— 详见下文「只有 `market` 有详情页」。

六个页签：**概览 / 文件 / 版本历史 / 权限 / 安全扫描 / 指标**。

| 页签 | 数据来源 |
|---|---|
| **概览** | 顶部是**指标条**（下载量 / 收藏 / 综合评分 / 版本），下面是简介与 `关键信息`、`适用场景`。**不内联 `SKILL.md`** —— 正文常常几千字，而它在「文件」页签里能完整阅读（带目录树与逐文件预览），在这里再排一遍只是重复来源、还会把 `关键信息` 挤出屏幕 |
| **文件** | `/files` 的扁平 `path` 列表，前端按 `/` 拆成**可折叠目录树**，每个目录标注文件数与体积。**所有目录默认折叠** —— 技能包动辄几十个文件、多层嵌套，展开一层就能看清结构，比一屏路径有用；分支按需展开 |
| **版本历史** | `/versions` 的逐条 `changelog` 与时间；**只展开最近 3 条**，其余折在「展开其余 N 个版本」按钮后（按钮带条数，所以折叠不会藏掉历史的规模）。顶部是**更新对比**（本地已装版本 vs `latestVersion`） |
| **权限** | 技能自身声明与本插件行为的区分说明 |
| **安全扫描** | `/skill-security`：逐家列出检测方与各自结论 |
| **指标** | 上游计数与**主页链接** |

### 指标条在**页签条上方**，不在任何页签里面

它一开始是抽屉的 `footer`（贴在页签内容**下方**），中间还短暂地被放进过概览页签的**内容里**。
两种都不对：作为 footer，它读起来像"这一页读完之后的小结"；放进概览，它就会随概览一起滚走 ——
而下载量、评分、版本是**无论看哪个页签都成立**的事实。

现在它位于技能信息与页签条**之间**，属于抽屉的固定区。注意 `.sm-insp-head` 是它的**兄弟节点而不是
父节点** —— 整个 `.sm-insp-body` 才是唯一滚动区，所以"是否固定"要按"是否在 body 里"判断。
`render-panel.mjs` 因此断言四件事：

| 断言 | 检查什么 |
|---|---|
| `overviewStatStripIsAboveTabs` | 用 `compareDocumentPosition` 确认它在页签条**之前** |
| `overviewStatStripOutsideBody` | 不在 `.sm-insp-body` 里 → 不随页签滚动 |
| `statStripSurvivesTabSwitch` | 切到「文件」页签后它仍然在，且数值不变 |
| `overviewStatStripIsNotAFollower` | 旧的 `footer` 已不存在 |

只断言"它存在"是不够的 —— 前两版都满足"存在"。

### 综合评分要截断

上游的 `score` 是**大浮点数**，实测某技能是 `75093.51584799575`。原样打印会把整条占满数字，
而且暗示了一个它并不具备的精度。现在统一走 `formatScore()`：取整 + 千分位 → `75,094`。
两处显示（指标条与「指标」页签）用的是同一个函数，不会一个圆整另一个不圆整。

> **`overviewMd` 是空的。** 实测 12 个技能（含腾讯官方 `tencent-adm/tencent-docs`）该字段
> 长度全为 0，所以概述改用 `SKILL.md`。`skill.summary_zh` 只在读不到正文时回退，
> 两者不会同时当作概述展示。
>
> 另一个之前写错的结论：README 曾写「SkillHub 未公开逐版本更新日志」—— **错的**，
> `/versions` 就是，实测 `dev-expert` 有 62 条真实 changelog。

**收藏页也能看详情**（原来只有已安装行和市场卡片可以）：收藏持久化的是完整记录，带
handle 与 slug，所以详情按钮走同一个抽屉。

### 看文件内容

目录树里的每个文件都是一行**按钮**（整行可点、也能键盘操作）。点开后在同一个抽屉里显示
内容,并留一个「返回文件列表」—— 不替换整个页签,所以连着看几个文件不用来回切:

- `.md` / `.markdown` **按 Markdown 渲染**（复用概述那套渲染器）
- 其他一律**原样显示在 `<pre>` 里** —— 预览不该假装看得懂这个文件
- 内容按 `<版本>:<路径>` 缓存,来回切不重复请求
- 超过 256 KB 的文件由 Host 回 `truncated`,界面说明「已截断显示」而不是显示半个文件

### 「已安装的是哪一版」不能靠包里的 version 字段

**实测撞到的一个坑,症状很误导人。** 装 `dev-expert` **2.0.2** 之后,重启面板却显示
**2.0.3**,看上去像「旧版本被自动还原成新版」。逐文件 sha256 对比磁盘:

```
v2.0.2: 84/84 match   <-- 磁盘上就是 2.0.2
v2.0.3: 76/84 match
```

**文件从来没被还原**,还原的只是**标签** —— 上游发布的 2.0.2 包,其 `SKILL.md` 里的
`version:` 字段写的是 `2.0.3`。上游不会可靠地更新这个字段,所以**不能用它判断装的是哪一版**。

版本来源分三层,按可信度排序,`/installed` 每一行都带 `versionSource` 说明用了哪层:

| `versionSource` | 来源 | 何时使用 |
|---|---|---|
| `record` | **安装时写下的记录** `<plugin>/data/installed.json` | 本插件装过的技能 —— 只有安装动作知道当时请求了哪一版 |
| `files` | **磁盘文件哈希匹配**上游各版本的清单 | 没有记录(更早版本装的、手工拷进来的):`versionMatchingDisk()` 取最近 4 个版本逐一比对 |
| `frontmatter` | 包内 `SKILL.md` 的 `version:` 字段 | 上面两条都不成立时的兜底,也**只有**这时才用 |

卸载会连同记录一起删掉,免得同名目录的后续安装继承旧标签。读 frontmatter 也改成
**只在前言块内**匹配 `^version:` —— 之前全文匹配会命中正文里的同名行。

**为什么不能反过来、以 `SKILL.md` 为准**（实测两个技能各有一版对不上）:

```
dev-expert        请求 2.0.2   → SKILL.md 写 2.0.3     ✗
parenting-expert  请求 1.11.4  → SKILL.md 写 1.13.0    ✗（上游从未发布 1.13.0）
```

那不是「慢一拍」而是**漂移**:作者会忘记改这个字段。用户磁盘上那份的实测是
`SKILL.md` 7885 字节、声明 `2.0.3`,而同字节数、逐文件 sha256 都指向上游 **2.0.2**。
所以 `frontmatter` 只作兜底 —— **声明答不对「磁盘上是哪一版」这个问题,事实才能**。

排查工具:`node ../scripts/which-version.mjs <handle> <slug>` —— 逐文件哈希比对,直接回答
「磁盘上到底是哪一版」,不依赖任何标签。

> **写测试时踩的坑(值得单列)。** `install-check.mjs` 原先直接写**真实技能根目录**。
> 我在跑回归时执行了它,把已经停在 **2.0.2** 的 `dev-expert` **重装成了最新版 2.0.3** ——
> 文件 mtime 全部落在同一秒,用户看到的是「没点更新按钮,怎么自己变新版了」。
>
> **一个会改写它所观察状态的测试是不可信的。** 现在该脚本在导入模块前把
> `DSH_SKILL_MARKET_ROOT` 指向 `mkdtemp` 出来的临时目录,并在跑之前断言
> `installedSkillRoot()` 确实是那个临时目录,否则直接拒绝执行;结束后删掉临时树。
> 回归时也确认真实技能根的 mtime **没有被改动**。

### 更新提示只在「已安装」和「收藏」

**发现页不显示更新按钮**（按需求）：卡片只有两种状态 —— 未装显示「安装」，已装显示
「已安装」。「发现」是用来找技能的，比较版本属于**即将被替换的那份安装**旁边。

| 位置 | 未安装 | 已安装且最新 | 已安装但落后 |
|---|---|---|---|
| 发现卡片 | 安装 | 已安装 | 已安装 |
| 已安装行 | — | 详情 · 开关 · 卸载 | **更新** · 详情 · 开关 · 卸载 |
| 收藏行 | 详情 · 安装 | 详情 · 已安装 | 详情 · **更新** |

「更新」的 tooltip 给出 `v2.0.1 → v2.0.3`。

三个事实同时成立才显示更新：**该技能已安装**、**本地版本已知**、**上游发布了不同的版本**。
缺任何一项都不显示 —— 这比猜一个更诚实。

本地版本由 Host 从**磁盘上那份 `SKILL.md` 的 frontmatter** 读取（安装时写进去的；手写或
本地导入的技能则是作者写的内容），上游最新版本由 `/installed` 顺带查询（每个已安装技能
一次详情请求，命中 5 分钟缓存，上限 40 个），所以这些数字不是缓存标签。

> **按 id 匹配已安装技能是不够的。** 同一个技能可能来自不同发布者：收藏里可能是
> `user_814dbe54/dev-expert`，而实际安装的是 `indiv-ebandao--dev-expert`。所以匹配走
> `installedEntryFor()`，以**磁盘目录名 `<handle>--<slug>`**（文件系统真正拥有的东西）为准，
> id 只是没有目录的行的兜底。「已安装」徽章与「更新」按钮共用这套判定，否则会出现
> 「显示已安装、却又没有更新信息」这种自相矛盾的状态。

### 按版本安装

版本历史里**每一行都能装那个版本**,装完**替换已安装的技能目录**（本地版本相同的那一行
显示「已安装」而不是按钮）。这不是装饰功能 —— 它的用途是某个新版本出问题时退回旧版本。

实现要点（也是这轮最容易做错的地方）：`version` 必须透传到**每一个文件**的下载。
实测 `dev-expert` 的 `SKILL.md`:带 `version=2.0.2` 返回 15557 字节且 sha256 与清单**一致**;
不带则返回最新版的 15020 字节、**不一致**。所以漏传不会报「版本不支持」,而是把不同版本的
文件混进一个目录,然后在校验处失败（或校验被跳过时静默装错）。

已安装技能换成另一个版本时先弹确认 —— 目录会被整体替换,不该被误点触发。
Host 报告的是清单响应里的 `version`,也就是**真正写下去的那个版本**。

### 只在「破坏性方向」确认

| 操作 | 是否确认 | 理由 |
|---|---|---|
| 安装 | 否 | 用户点了「安装」，意图明确 |
| 更新到新版 | 否 | 「更新」按钮说的就是这件事；每次都问会训练用户盲点确认 |
| **回退到旧版** | **是** | 与按钮字面意思相反，且会丢掉当前版本的文件 |
| **卸载** | **是** | 从磁盘删除目录，重装要走网络，误点不可撤销 |

确认框是**面板自己的对话框**（`ConfirmDialog`），不是 `window.confirm`：原生弹窗无法定制样式，
在桌面外壳里看起来像浏览器警告而不是产品的一部分。这个对话框会说明**具体要动什么**
（目录名与文件数），把焦点放在确认按钮上、保留 Escape 与点击遮罩两种退出方式，
确认操作在关闭后才执行（动作可能会清掉它自己引用的对象）。

早先这里用过 `window.confirm`，并有一条规则：**该 API 不存在时视为「继续」**。缺失的对话框不等于
用户放弃了刚才的请求 —— 把缺失当成拒绝曾让整个版本安装流程静默失效，而当时的断言只检查了按钮
**渲染**、没有点击它，所以没被发现。改用自带对话框后这条规则不再需要，但同样的教训让
`render-panel.mjs` 现在**真的点击**确认与取消两条路径。

上游接口的 curl 清单见 [`docs/skillhub-api.md`](skillhub-api.md),里面记了
`version=` 在各端点的实测行为（以及 `versionId=` / `v=` 会被忽略这件事）。

## 运行时状态必须放在包外

启用 = 在 `$DSH_HOME/skills`；停用 = 在
**`$DSH_HOME/storages/@montersy123/dsh-skill-market/data/skills`**。
所以**任何动文件的操作都必须用同一套定位规则**，否则两边会各说各话：

| 操作 | 行为 |
|---|---|
| 安装（新技能） | 写到启用目录 |
| 安装（**已停用**的技能） | 写回**停用目录**，结果带 `enabled: false`；界面提示「已更新…仍处于停用状态」，开关**不会**被打开 |
| 卸载（已停用） | 从**停用目录**删除，返回 `wasDisabled: true` |
| 卸载（已启用） | 从启用目录删除，返回 `wasDisabled: false` |
| 卸载（不存在） | 明确报错，不静默成功 |

实现上安装与卸载共用 `locateInstalled()`：**两个根都不是「主」目录**，技能在哪就在哪操作。
之前两边各写一套（安装只认启用目录、卸载先查启用再查停用），技能同时存在于两个根时就会分叉
—— 于是出现「停用的技能安装后跑到了 skills 下面」。

### 状态目录的三个选择

`$DSH_HOME/storages/@montersy123/dsh-skill-market/data`：

**① 在包外。** 停用库和安装记录一度放在 `<package>/data`，**任何替换包目录的动作都会把它删掉**
—— `pnpm install`、手动重装、中断的升级、以及本插件自己的安装器。后果是**所有已停用的技能全部
复活**，版本记录一起丢失。

> 在安装器里加一段「先备份、后还原」只是**碰巧能用**的补丁：它只在所有人都记得执行时才成立，
> 而上面每条路径都能绕开它。把状态搬出包外，这个风险是**结构性消失**的，不依赖任何脚本的自觉。

**② 放在 `$DSH_HOME/storages` 下。** 这是 DSH 存放「插件自有状态」的地方 —— `dsh-cost-meter`
的账本就在 `storages/cost-meter/ledger.json`，所以这不是新造的位置。它以前在 profile 目录里
（`<profile>/@montersy123-dsh-skill-market/`），现在是 **DSH home 级、不分 profile**：同一个 home 下
同时跑 `desktop` 与 `web`，收藏与账本是**同一份**。这是有意的取舍（状态跟着"这个 home 里装了什么"
走，而不是跟着"从哪个入口打开"走），代价是这两个 profile 的偏好不再各自独立。

**③ 用包名的两段。** `@montersy123`，然后 `dsh-skill-market`：路径本身说明是哪个包拥有它，scope 是
一层目录，而不是把分隔符压平塞进名字里。

### 目录名的历史，以及为什么现在**不做**兼容

存放停用技能的目录搬过多次、也改过一次名：

```
$DSH_HOME/skill-market/disabled                    （初版）
<package>/data/disabled                            （放进包内）
$DSH_HOME/skill-market/data/disabled               （搬出包外）
<profile>/@montersy123/skill-market/data/disabled  （profile 级，嵌套式）
<profile>/montersy123/skill-market/data/disabled   （纯用户名的中间形态）
<profile>/@montersy123-skill-market/data/disabled      （发布者+插件）
<profile>/@montersy123-dsh-skill-market/data/disabled  （用包名）
<profile>/@montersy123-dsh-skill-market/data/skills    （现在：skills）
```

存放位置本身也搬过多次：

```
<package>/data                                          （放进包内）
$DSH_HOME/skill-market/data                             （搬出包外）
<profile>/@montersy123/skill-market/data                （profile 级，嵌套式）
<profile>/montersy123/skill-market/data                 （纯用户名的中间形态）
<profile>/@montersy123-skill-market/data                （发布者+插件）
<profile>/@montersy123-dsh-skill-market/data            （压平的包名）
$DSH_HOME/storages/@montersy123/dsh-skill-market/data   （现在）
```

**这些位置现在都不再被读**，包括最后那个 profile 目录：代码只读 `storages` 下这一处。版本记录
（`installed.json`）也不再从旧位置收养 —— 做这件事的 `migratePluginData()` 已随这次搬迁删除。
旧位置留下的目录就是「没人读的另一个目录」。

代价说清楚：**从旧版本升上来的人需要自己把旧的 `data` 目录整个搬到新位置**
（`panel.json`、`installed.json`、`skills/` 三样一起），不搬就是从零开始 —— 收藏、账本、停用状态
都会看起来不见了（文件还在磁盘上，没被删）。这条路径不再有代码维护。

**这一轮改的只是"文件放在哪"。** 面板里的「启用 / 停用」、`enabled` / `disabled`、`/installed`
返回的 `disabledRoot`、日志里那句 `enabled|disabled` —— 这些**状态词一个都没动**。它们说的是技能
是开还是关，和文件放在哪个目录无关。上一轮把停用库的目录名从 `disabled` 改成 `skills`，同样只动
了目录名。

名字只来自 `PARKED_DIRECTORY`（`lib/index.js` 顶部）一个常量：`ensureStateTree()`、扫描、启停
都从它取，改一处就够。`installed-copy-check.mjs` 钉住它等于 `skills`，并钉住代码里**没有**任何
旧的目录名；`disabled-target-check.mjs` 则断言旧名字下的目录**不会被**收养，防止它悄悄回来。
`state-root-check.mjs` 用临时 `DSH_HOME` 跑一遍真实公式，钉住状态根就是
`storages/@montersy123/dsh-skill-market/data`、且不在任何 profile 目录下。

### `data/` 与 `data/skills` 都常驻，不清理

两个目录**永久存在**，不会因为变空而被删。早先的实现在没有停用技能时会删掉整个 `data/`，于是
这棵树随「当前有没有东西被停用」出现和消失 —— 既吵闹，也因为版本记录就在同一个目录里，离
「记录被误删」只差一次意外。

还有一个更基本的好处：**「没有停用任何技能」是空目录，而不是目录不存在**。否则读状态的代码
必须把「不存在」与「空」当成同一件事的两种写法，任何一处漏判就会让停用技能复活。

`ensureStateTree()` 在激活时、以及每次安装后都会补建，所以全新安装也立刻拥有完整的树。

`disabled-target-check.mjs` 的 38 条断言锁住这组行为，其中一条把状态根**真的搬到另一个位置**再
读回来，断言停用的技能与它的版本记录依然在 —— 验证的是性质，不是路径字符串。（这条断言此前是
假的：override 指的是**技能根**、数据根由它按兄弟目录推导出来，而当时的脚本只把目录复制到一个
随机临时目录再改 override，于是插件读的还是原来那份数据，断言无论如何都会通过。现在搬迁按真实
布局嵌套，并且额外断言数据根**确实**变了。）

### 面板自己的状态也在这个目录里：`data/panel.json`

浏览器半（面板）的持久化状态——收藏（id 数组 + 完整记录）、已安装账本、类目偏好、待重启提示
——同样放在 `$DSH_HOME/storages/@montersy123/dsh-skill-market/data/panel.json`，与 `installed.json`、
`skills/` 并列。

它以前放在页面的 **Web Storage** 里。那个存储**不是本插件的**：桌面端下它是
`%APPDATA%\@deepseek-ai\dsh-desktop\Local Storage` 下的一个 LevelDB，与 DSH 自己的键、以及
每个别的插件**共用一份**，按 **origin** 而不是按插件寻址。于是插件的数据躺在 DSH 的数据里、
卸载插件不会带走它、用户也找不到自己的收藏去了哪。私有目录没有这些问题：换包不丢、
可以被用户查看/备份/删除。

| 端点 | 作用 |
|---|---|
| `GET /skill-market/api/state` | 返回 `{ state, revision, harnessStartedAt }`；文件不存在时 `state: null` |
| `POST /skill-market/api/state` | 整份文档覆盖写入；body 必须是 JSON 对象，上限 4 MiB |

三个实现细节：

- **写入是原子的，并且会重试。** 先写 `panel.json.tmp` 再 `rename`：半截的 JSON 是这份文档唯一
  无法恢复的故障——丢的不是最后一次改动，而是全部收藏。Windows 上"替换一个别人正开着的文件"
  会以 `EPERM`/`EACCES`/`EBUSY` 失败（杀毒、备份、索引器恰好看了一眼那个文件），所以 rename
  带重试，与停用库搬运同一个理由，也是同样**实测**出来的：`EPERM: operation not permitted,
  rename` 让存储落后了一次改动。写入还串行化（`panelWriteChain`），两个请求不会抢同一个临时文件。
- **`revision` 用文件 mtime**，读写两侧报的是同一个数，所以客户端能区分「没变」与「别的窗口
  写过」。这取代了 `localStorage` 的 `storage` 事件：文件不会自己通知任何人，所以面板在挂载、
  窗口重新获得焦点、以及每 10 秒（`PANEL_SYNC_INTERVAL_MS`）问一次 Host。
- **读取在渲染前，写入立刻发。** `readState()` 是在首次渲染里调用的，渲染不能 await 请求，
  所以文档在内存里有一份副本（`panelDocument`），读是同步的，写是"改内存 + 立即 POST"。
  **在 hydration 完成之前拒绝一切写入**——先写会把文件覆盖成本页的默认值，那是数据丢失而不是
  可以容忍的竞态；挂载对账也 await 同一个 promise，否则 Host 的 `/installed` 答复会被它本该
  纠正的账本覆盖。

> 写入**曾经**延后一个 tick（想把一次操作产生的两处改动合成一个请求）。实测证明不划算：
> 合并本来就会发生（写入在途时第二次调用只标脏，在途的循环会重发最新的文档），而定时器
> 带来的是**一个改动还没落盘的时间窗口** —— 第一次跑集成检查就在这里丢了 pending。
> `localStorage` 当年是同步写的，换成文件没有理由开始丢最后一次改动。

> **迁移**：`dsh-skill-market/v1` 与 `dsh-skill-market/pending/v1` 这两个 Web Storage 键由
> `hydratePanelState()` **读一次**（文件不存在时采用它们），随后**删除**。删掉它们是这次搬迁的
> 目的本身，而不是顺手清理。文件已经存在时以文件为准——它是更新的那份权威。

> **删除必须发生在写入落盘之后。** 第一版是在采用旧数据的同一个函数里就把键删了，于是
> "新 client + 旧 Host"（Host 半还没有 `/state` 路由，客户端却被热更新了）这种组合会：
> 读到旧数据 → 删掉旧键 → POST 404 → **数据没有任何地方可存**。这不是假设，它真的发生了：
> 收藏只能从 LevelDB 的 write-ahead log 里把最后一条 `Put` 捞回来，日志里 `seq=1893`/`1902`
> 两条 DELETE 就是那次事故。捞回来的工具留在
> [`../scripts/dev/recover-panel-state.mjs`](../scripts/dev/recover-panel-state.mjs)：它把 LevelDB
> 日志格式与 Chromium Local Storage 的取值编码写下来了，重写一遍等于把这两件事重新推一遍。
>
> 现在的顺序是：采用 → 写入 → **写入成功才删**。并且当写入失败时（旧 Host、请求出错），把
> 文档按旧格式写回 Web Storage 作为**救生副本**（`writeLegacyStorage()`）——新家暂时用不了，
> 丢掉用户的收藏比多写一次旧家更糟；副本会在下一次成功写入时连同旧键一起消失。
> `legacy-saved-check.mjs` 用例 5 专门驱动"Host 拒绝写入"，断言旧键仍在、救生副本里有收藏、
> 面板照常渲染。
>
> 两份副本同时存在时（页面还跑着旧 client，直到它被关掉）**收藏取并集**，其余以文件为准：
> 账本、`enabled` 是 Host 推导出来的缓存，类目是偏好，而收藏是只有用户能创造的东西——
> 把用户在另一个窗口刚收藏的技能丢掉，比偶尔复活一个他刚取消的收藏更糟（`mergeFavorites()`，
> 用例 6）。
>
> **记录只在收藏列表还点得到它时才保留。** `saved` 是要渲染的 id 列表，`savedSkills` 是让它
> 渲染得出来的记录——两者是一件事。旧版本可能删了 id 却留下记录，于是它永远躺在文件里：面板
> 不显示、代码不引用，只有打开文件的人才看得见。`sanitizePersisted()` 在每次读取时清掉这种
> 孤儿记录，并因此把文件重写一遍（用例 7）。

`legacy-saved-check.mjs` 的用例 3/4/5 锁住这段迁移（采用后仍完整、旧键被删、文件优先、
Host 拒绝写入时**不删**且留救生副本），
`panel-sync-check.mjs` 锁住跨窗口那条路（焦点同步采用别的窗口写的文档、且**不会**写回去），
`route-check.mjs` 从真实 HTTP 上锁住路径与上限，而 `panel-live-check.mjs` 把**面板与真实的
Host 半**接到一起跑（两个桩各自都对、协议却对不上，是只有这种检查能抓到的一类缺陷 —— 它当场
抓到了上面那条 `EPERM` 重试与丢失的写入）。`render-panel.mjs` 现在完全不需要 Web Storage
了 —— 连 `dsh-app://app/`（jsdom 里没有 `localStorage` 的自定义 scheme）也能原样渲染，这正是
这次搬迁的直接结果。

## 必须结构性防住的工具坑

**① 测试脚本绝不能写真实技能目录。** `DSH_SKILL_MARKET_ROOT` 在 `import` **之后**赋值是**无效的**
—— ES import 会被提升到赋值之前，于是脚本以为自己在沙箱里，实际动的是用户的真实目录。后果实测过：
一个检查脚本在真实根上先 install（把用户固定在 2.0.2 的技能覆盖成 2.0.3）再 uninstall
（**把目录删掉**），用户重启后发现技能不见了。

> `DSH_SKILL_MARKET_TEST_ONLY=1` 一旦设置，`skillRoot()` / `pluginDataRoot()` 在缺少
> `DSH_SKILL_MARKET_ROOT` 时**直接抛错**。`install-check.mjs`、`skills-provider-check.mjs`、
> `disabled-target-check.mjs` 都带这个开关，顺序写错就立刻失败，而不是静默写真实目录。
>
> 排查方式也换过一次：**「跑前跑后比对」的指纹探针不可靠** —— 第一个脚本一改，后续所有比较的
> 基线就都是错的，于是它给出「无脚本触碰」的**假结论**。改用 `--import` 钩子记录真实的 `fs`
> 写操作（`fs` 的 CJS 对象可以打补丁，ESM 命名空间不能），才拿到确定答案：完整套件下真实
> 写入 **0 次**。

**② 修复工具必须面向运行时真正加载的模块。** 安装记录写在**执行安装的那份拷贝**旁边。我一开始
用源码树去修复，技能文件修好了，而运行时用的安装副本仍记着旧版本 —— **看起来修好了，其实没有**。
所以 `restore-skill.mjs` 默认加载**安装副本**（`RESTORE_FROM_SOURCE=1` 才切到源码树），并且在写之前
断言解析出的根确实是 `$DSH_HOME/skills`，免得一次修复变成第二次事故。

```
node ../scripts/restore-skill.mjs <handle> <slug> <version>   # 写：把真实技能根恢复成指定版本
node ../scripts/which-version.mjs <handle> <slug>             # 只读：逐文件哈希判定磁盘上是哪一版
```

**③ 样式表整体是一个模板字符串，注释里不能出现反引号。** 在 CSS 注释里写 `` `类名` `` 会把字符串
提前闭合，于是文件在**离那一行很远的地方**报语法错误，而 diff 里完全看不出来。我在一次编辑里
连着犯了两回（`sm-card-title`、`position: relative`），两次都是 `node --check` 才发现的。

`../scripts/css-literal-check.mjs` 因此常驻验证流程：它定位样式表模板、检查体内**没有**残留反引号、
并确认规则数量在合理范围（少于 100 条就说明被截断了）。

**④ 绝不要用 PowerShell 的 `Get-Content` / `Set-Content` 改动文本文件。** Windows PowerShell 5.1
的 `Get-Content` 默认按**系统 ANSI 代码页**解码，而这个仓库的文件是 UTF-8：读一次再写回去，中文
就全变了样（`收藏` → `鏀惰棌`），并且会带上 BOM。实测代价：一条为了改一个词的 `-replace` 让
 `legacy-saved-check.mjs` 里所有中文断言字符串报废，检查随即以"找不到收藏页签"失败 —— 报错指向
运行时，而真正的故障在文件编码上。文件内容的编辑一律走编辑器工具（或 `[IO.File]::ReadAllText`
配显式 `UTF8` 编码），`../scripts/encoding-check.mjs` 会把 BOM 与乱码挡在提交之前。

## 卡片头部的行布局曾经完全缺失

`.sm-card-top` 在很长一段时间里**没有任何 CSS 规则** —— 而它的子元素 `.sm-card-title` 写着
`flex: 1`，那在非 flex 父元素里是**空操作**。也就是说：头部这一行从来没有获得它被写出来时的布局，
图标、标题、收藏按钮一直是按块级元素各占一行堆叠的。

这是靠一次**类名审计**发现的（渲染了但没样式的类名），不是靠肉眼看渲染结果 —— 堆叠的样子也不会
报错，只是很丑。修的时候顺带把收藏按钮从头部行移出来，改成绝对定位钉在卡片右上角：

```css
.sm-card-top { display: flex; align-items: flex-start; gap: 10px; }   /* 补上的行布局 */
.sm-card > .sm-save-btn { position: absolute; top: 12px; right: 12px; }  /* 钉在卡片角上 */
.sm-skill-card .sm-card-title { padding-right: 34px; }                  /* 长名字不钻到按钮下面 */
```

收藏是**单张卡片的操作**，不是技能身份的一部分，所以它不该在标题行里和名字抢宽度。因为用的是绝对
定位，它必须是卡片 `article` 的**直接子元素** —— 嵌在头部里就会相对头部定位。`render-panel.mjs`
断言的正是这一点（`saveButtonIsDirectCardChild`、`saveButtonIsNotInHeader`），因为这是唯一会让
"右上角"变成"右上角偏一点"的区别。

## 安装状态

**真实拷贝**到 `desktop` profile，而不是软链：

```jsonc
// ~/.dsh/profiles/desktop/package.json
"dependencies": { "@montersy123/dsh-skill-market": "file:…/../scripts/dist/montersy123-dsh-skill-market-1.0.0.tgz" },
"dsh": { "profile": { "bundles": [ /* … */ "@montersy123/dsh-skill-market" ] } }
```

```
~/.dsh/profiles/desktop/node_modules/@montersy123/dsh-skill-market/   ← 真实目录
```

为什么不用 `link:`（早期版本是 junction）：**插件的状态目录当时在它自己的包内**
（`<package>/data/disabled`，那份状态如今在 profile 下，见「运行时状态必须放在包外」），软链会让这份状态写进源码仓库；而且真实拷贝在
`node_modules` 里的位置和别的 bundle 完全一致。

包名是 **scoped** 的（`@montersy123/dsh-skill-market`），这样后续通过 npm 安装时不会
和别人的插件重名。scope 是账户名，所以安装目录是**两层**
（`node_modules/@montersy123/dsh-skill-market`）—— 脚本按包名拆分路径。

### 为什么走打包安装

试过两条路都不行，记下来免得重复踩：

| 做法 | 结果 |
|---|---|
| `"dependencies": { "…": "1.0.0" }` | 未发布前 `ERR_PNPM_FETCH_404` —— 纯版本号必须能在 registry 解析 |
| `"dependencies": { "…": "file:<目录>" }` | pnpm 把包**链接**进 `node_modules`，正是要摆脱的形态 |

`npm pack` 两者都绕开：它按 manifest 的 `files` 列表打包，所以 `data/` **由构造保证**
不进去（不需要额外过滤器）；pnpm 则把 tarball 装成**真实目录**，并写一条可解析的
lockfile 记录。实测确认安装后 `lstat().isSymbolicLink() === false`。

```bash
node ../scripts/install-plugin.mjs           # 先看会做什么
node ../scripts/install-plugin.mjs --apply   # 打包 → pnpm add file:<tgz> → 校验
```

脚本还会：删掉遗留的未加 scope 的 `dsh-skill-market` 目录（junction 用 `rmSync(recursive:false)`
删除，**绝不用递归**，否则会穿过链接删掉源码仓库）与依赖行、把 `bundles` 里的旧名字改成
新名字、并断言 `data/` 没有被打包进去。manifest 里的 `files` 字段决定发布内容，
`../scripts/dist/` 是生成物。

改 `lib/client.js` 后由 `dsh-hmr` 把新的 bundle revision 推给已打开的页面；
改 `lib/index.js`（Host 半）则需要重启 App。

> **改名时不要动这两个 Web Storage 键**：`dsh-skill-market/v1` 和 `dsh-skill-market/pending/v1`
> 是**旧版**在用户机器上留下的身份，`hydratePanelState()` 靠它们一次读取把老数据搬进文件；
> 跟着包名一起改会让已收藏的技能和已加载的账本凭空消失。搬迁完成后它们不再被写入，只在这一次
> 读取后删除。`id`（`window.__ModuleLoader__.load` 的那个）则**必须**等于包名，内核是按包来
> 解析这个注册的。

### 面板状态存哪、存什么

（存的是 `data/panel.json`，见前面「面板自己的状态也在这个目录里」。）

| 状态 | 是否持久化 | 理由 |
|---|---|---|
| `installed` / `saved` / `savedSkills` / `enabled` | **是** | 用户的数据，重载后必须还在 |
| `category` | **是** | 描述的是**偏好** —— 改变列表显示什么 |
| `pending`（待重启提示） | **是** | 刷新后仍要提示，重启后必须消失 —— 见下 |
| `sortBy` | **否** | 进入发现应当永远是默认顺序，否则首屏取决于一个看不见的旧选择 |
| `view`（发现 / 已安装 / 收藏 / 本地导入） | **否** | 从侧边栏进来应当落在**发现**，而不是上次离开的地方 |
| 本地导入的技能 | **否（也不该）** | 它在磁盘上，由 Host 扫描得出 —— 见下 |

`view` 刻意不写进存储：`emptyState()` 与 `readState()` 都把它固定为 `market`，`writeState()`
也不再写这个字段。跨标签页同步本来就没同步它，所以去掉之后行为完全一致，只是不再有「上次停在哪」
这件需要解释的事。

### 本地导入：从前它什么也没做

早先的「本地导入」**只读文件名和字节数，然后把文件丢掉**：

```
addLocalFiles 里调用 apiPost / api / 读取文件内容 → 全是 false
Host 里本地导入的路由                            → 不存在
```

于是面板列出一个**在任何地方都不存在**的技能：没写进 `$DSH_HOME/skills`，注册表里没有，
模型调不到，而且那行只活在**同一个浏览器的 Web Storage** 里 —— 换 profile、清缓存就消失。
（那次实现正是把面板状态放进 Web Storage 的最初原因；现在它落在插件自己的
`data/panel.json` 里，但"列表要有磁盘上的东西撑着"这条结论没有变。）
`version` 甚至是硬编码的 `0.1.0`，启用开关只改一个布尔值。

现在它是真的：

| 环节 | 实现 |
|---|---|
| 上传 | `POST /skill-market/api/import?name=<文件名>`，**body 就是文件字节**（不是 JSON/base64 —— 那会膨胀三分之一并先变成字符串） |
| 解包 | `readZipEntries()` 自己解析 ZIP 中央目录，**只用 `node:zlib`**。不调用 `tar` / `Expand-Archive`：这台机器有，用户的机器不一定有，而依赖外部二进制的功能会在别处坏掉 |
| 校验 | 必须含 `SKILL.md`，且 frontmatter 的 `name` 必须是 kebab-case、`description` 必须存在 —— 与注册表加载时的要求一致。不校验的话会「导入成功」然后永远不出现，看起来像导入坏了 |
| 落盘 | 写到 `$DSH_HOME/skills/local--<name>`，与市场安装同一个根，所以 Harness 直接能发现并调用 |
| 账本 | **不再有独立账本**：`imported` 由 `/installed` 扫描得出（`origin: 'local'`）。目录就是记录 |
| 移除 | 走与卸载相同的路径（含确认框），因为这就是同一个操作 |

界面只接受 **`.zip`**（文件选择框的 `accept` 也是 `.zip`），提示只写「支持的格式只有 .zip 压缩包，
文件大小不能超过 50 MB」。Host 侧另有一个宽容之处：一个裸 `SKILL.md` 也会被当作单文件技能接受 ——
这是给 API 与测试用的，不在界面里宣传。上限 `MAX_IMPORT_BYTES = 50 MB`，**超出时在读取过程中拒绝**，
而不是先缓冲完再判断，否则限制只是事后统计损失。

> 曾经短暂支持过「整个技能目录」（前端把目录打成 stored ZIP 再上传），后来按要求撤掉了 ——
> 只保留拖放 `.zip`。那段代码里唯一值得留下的结论：浏览器侧压缩需要 deflate 实现，而平台没有
> 同步版本，所以那条路只能写不压缩的 ZIP；既然功能不要了，这层复杂度也就没有存在的理由。

ZIP 读取器只实现技能包需要的部分（stored + deflated、无加密、无分卷、无 ZIP64），其余明确拒绝；
同时丢弃任意层级的 `__MACOSX` 与 `._*`（**实测过**：只在第一段判断会让 `pkg/__MACOSX/...` 落进
技能目录），并拒绝 `../` 逃逸。

`import-check.mjs` 的 23 条断言用手工构造的 ZIP 覆盖这些分支，`route-check.mjs` 的 15 条断言把
注册好的 `handle` 挂到**真实 HTTP 服务器**上跑一遍 —— 客户端发的请求形状（原始字节、
`octet-stream`、文件名在 query）是被验证的，而不是假定。

**客户端插件的首次装载只能靠启动**：`dsh.client` 的 bundle 行在启动时写进
`window.__DSH_BOOT__`，页面刷新不会补上缺失的行。所以新增/改名的客户端插件之后，
必须重启一次 App 才能看到面板入口。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | bundle 清单：`dsh.bundle.patch` + `dsh.client`（`platform: web`，`exports["./client"]` 指向 `lib/client.js`） |
| `cordis.patch.yml` | 往 profile 插件树插入一行 `skill-market` |
| `lib/index.js` | **Host 半**：`/skill-market/api` 路由（读代理 + 安装/卸载/清单写入）、下载与校验、`ctx.skills` 提供方 |
| `lib/client.js` | **Client 半**：`window.__ModuleLoader__` 懒工厂，把原型设计还原成 `main` 面板 + `sidebar.panellist` 入口 |
| `icon.svg`、`locale/*.json` | 插件管理页的图标与标题/描述文案 |

### Host 半的路由

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/skill-market/api/skills` | 代理技能列表（`page`/`pageSize`/`sortBy`/`keyword`/`category`…），5 分钟内存缓存 |
| GET | `/skill-market/api/categories` | 代理分类表 |
| GET | `/skill-market/api/installed` | 列出磁盘上的技能目录与体积（含 `origin`、`installedAt`、版本来源） |
| POST | `/skill-market/api/install` | 下载并安装一个技能 |
| POST | `/skill-market/api/uninstall` | 删除一个已安装技能 |

## 为什么 Host 侧要有代理

`api.skillhub.cn` 只回 `Access-Control-Allow-Credentials`，**不回**
`Access-Control-Allow-Origin`，浏览器端 `fetch` 直接读不到响应。因此 Host 半在
Node 里取数据，Client 半改调同源路径：

```
浏览器 → /skill-market/api/skills      （同源，无 CORS）
            ↓ Node fetch
         https://api.skillhub.cn/api/skills?…
```

支持 `page / pageSize / sortBy / order / keyword / category / source / labels`，
`pageSize` 上限 100，成功响应缓存 5 分钟（最多 64 条查询）。

### 断网 / 上游超时：地址在哪、面板说什么

上游地址**只有一处**：`lib/index.js` 顶部的 `UPSTREAM`（`https://api.skillhub.cn`）。Client 半不直连
上游，它只调同源的 `/skill-market/api/*`，所以不存在第二处地址。手工测两种情形就是改这一行：

| 想测 | 把 `UPSTREAM` 改成 | 现象 |
|---|---|---|
| 断网 / 连不上 | `http://127.0.0.1:9`（没人监听的端口） | 立刻失败 |
| 上游超时 | 一个不回包的地址，例如 `http://192.0.2.1`（保留网段 TEST-NET-1） | 15s / 30s / 60s 后超时 |

它是 **Host 半**：改完必须**重启 DSH**（Client 半热重载，Host 半不会）。

Host 表达"我没读到上游"只有一个信号：**502**。面板把 502/504 显示成
**「连不上技能市场，请检查网络后重试」**，而不是以前那句 `技能市场上游请求失败：fetch failed`；
Host 自己完全没应答（重启中、页面连接断了）也落到同一句，而主动取消（`AbortError`）仍被静默忽略
—— 否则切分类时的取消会冒出一条假故障。

断网与超时共用一句话，是因为**纯前端拿不到更多信息**：Host 回的文本里虽然有 `TimeoutError`，靠匹配
英文子串判断原因是脆的。想分开说"超时"和"连不上"，需要 Host 多回一个类别字段 —— 那就不再是纯前端改动。

检查：`scripts/offline-check.mjs` 断言 Host 在上游不可达时仍回 502（而"面板自己请求不合法"仍是 400），
并且客户端确实把 502/504 与"Host 完全不答"映射到 `err.offline`。

## 视觉契约

Token 名称与原型 `:root` 一一对应（`--bg` → `--sm-bg` …），浅色取值就是原型导出的
oklch 数值，深色另配一套；`--sm-surface / --sm-accent / --sm-border` 等优先绑定宿主
主题 token（`--dsw-alias-*`），所以面板会跟着 Harness 主题切换走。

原型的响应式断点全部保留（1024 / 920 / `prefers-reduced-motion`）。

### 两处按使用反馈对原型做的结构调整

1. **卡片铺满，列数随窗口走。** 原型是固定 `minmax(300px, 1fr)`，在 1440 以上也只有
   三四列。这里改成固定 `280px` 轨道下限 + `auto-fit`，列数与窗口宽度单调增长：

   | 窗口 | 360–600 | 820 | 1024 | 1366 | 1440 | 1920 |
   |---|---|---|---|---|---|---|
   | 列数 | 1 | 2 | 3 | 4 | 4 | 6 |
   | 卡片宽 | 312–552 | 379 | 316 | 319 | 337 | 281 |

   内容宽度上限从原型的 1160px 放宽到 1760px（`.sm-bounded`）。轨道下限用固定值而不是
   `vw`：百分比下限会随窗口变大，反而**减少**宽屏上的列数（1920 实测掉到 4 列）。
   `tools/grid-columns.mjs` 会把这个矩阵和单调性一起断言。

2. **只有卡片列表滚动。** `.sm-fixed`（标题 + 排序 + 分类 chips）与顶栏、视图 tab、状态栏
   都是 `flex: 0 0 auto`，只有 `.sm-content` 是 `overflow-y: auto` —— 所以滚到底部时
   排序控件和筛选条件仍在原地。切换分类/排序/搜索词会把列表滚回顶部（否则会在新结果
   的中间位置停下）。`tools/render-panel.mjs` 的 `structure` 断言会检查这几个元素究竟
   落在哪个区里。

### 与原型的有意差异

| 原型 | 这里 | 原因 |
|---|---|---|
| 左侧品牌栏 + 账户行 | 无 | 宿主 shell 已经有侧边栏，面板里再画一个会出现两个导航 |
| 窗口 chrome（顶栏只放搜索 + 动作） | 保留内容，去掉品牌 | 同上 |
| 星级评分、用户评价、更新日志 | 换成下载量 / 收藏数 / 综合评分 / 版本与来源 | SkillHub 不提供评分与评价；编造数据会误导用户 |
| 「安装」改版本号 | 「安装」= 收进本机技能库 + 启用开关，可撤销 | 原型是静态演示；这里不假装能改远端 |
| 本地导入立刻成行 | 同样成行，另加启用/移除与撤销 | 一致 |
| 固定 300px 卡片 / 整页滚动 | 280px 轨道下限铺满 + 只滚卡片列表 | 使用反馈：一行三张太少，筛选条件应常驻 |

## 验证方式

`../scripts/` 下有一套不依赖浏览器的自检脚本（已随仓库保留）。**改完客户端代码先跑第 1 条**，
它是复现「web boot: 1 entry did not activate」的同一段内核代码：

```powershell
# 1. 用真实内核代码走一遍客户端插件的装载 + 激活审计
#    （@deepseek-ai/dsh-client-modules/lib/client.js 的 arrive/materialize/entries.start）
$env:DSH_PROFILE_DIR="$env:USERPROFILE\.dsh\profiles\desktop"
node ../scripts/boot-client-check.mjs @montersy123/dsh-skill-market
# 期望：ok @montersy123/dsh-skill-market: inject=["slots"] slots=[...] / boot audit: all entries active

# 2. 语法 + 工厂求值 + 渲染冒烟
node ../scripts/check-client.mjs packages/dsh-skill-market/lib/client.js --react ../scripts/reactsmoke/node_modules

# 3. jsdom 里用真实 SkillHub 响应渲染面板并跑交互；两个页面来源都要过
$env:PANEL_PAGE_URL="dsh-app://app/";        node ../scripts/render-panel.mjs --fixture ../scripts/fixture --viewport 1920x1080 --interactions
$env:PANEL_PAGE_URL="http://127.0.0.1:19387/"; node ../scripts/render-panel.mjs --fixture ../scripts/fixture --viewport 390x844

# 4. 卡片列数矩阵（固定轨道下限 280px 的断言）
node ../scripts/grid-columns.mjs

# 5. Host 半 + 安装状态
node ../scripts/verify-install.mjs

# 6. 国际化（任一失败即说明界面文案出了问题）
node ../scripts/i18n-remaining.mjs       # 还有多少中文没接进字典；必须为 0
node ../scripts/i18n-keys-check.mjs      # 证明键扫描器「该抓的抓、不该抓的不抓」
node ../scripts/i18n-key-audit.mjs       # 面板用到的每个键都必须在两个字典里
node ../scripts/locale-check.mjs         # 键集对齐、占位符一致、类目 key 覆盖
node ../scripts/generated-block-check.mjs
node ../scripts/inline-client-locale.mjs --check
```

第 3 条输出卡片数、chip 数、状态栏文案、控制台报错、交互结果
（安装 → 已安装列表 → 收藏 → 本地导入 → 详情四个 tab），以及 `structure` 断言：
页头 / 排序 / chips 必须在 `.sm-fixed` 里，卡片网格必须在 `.sm-content` 里，反向出现即报 false。
jsdom 没有排版引擎，**横向溢出和实际列数必须在真实页面里确认**（列数用第 4 条推算）。
它现在**不需要 Web Storage**（面板状态走 Host 的 `/state` 路由），所以
`PANEL_PAGE_URL=dsh-app://app/` 也能原样跑 —— 那是桌面端真实 origin，jsdom 在那里没有
`localStorage`。

`node ../scripts/run-checks.mjs` 会把上面全部（含 `legacy-saved-check` /
`restart-advice-check` / `panel-sync-check` / `panel-live-check` / `route-check`）按顺序跑一遍
并按退出码汇总。其中 `panel-live-check.mjs` 是唯一把**面板与真实 Host** 接起来跑的一条：它把
`lib/index.js` 挂到真实 HTTP 服务器上，再在 jsdom 里装载 `lib/client.js`，只把上游
`api.skillhub.cn` 换成 fixture —— 于是"客户端发的形状"与"Host 认的形状"是互相验证的，
而不是各自对着桩自证。

## 国际化（中英双语）

面板的**全部 242 条文案**都走字典，没有任何硬编码的界面文字。语言由 DSH 自己的
「设置 → 常规」控制，面板不做第二个开关 —— 那会是同一件事的第二个事实来源。

### 三个必须知道的事实

1. **客户端 bundle 读不到 `lib/locale.js`。** 它是 classic script，只拿到 `require('react')`；
   模块加载器只认平台 seed 与已注册 factory，**没有文件系统**。所以字典由
   `../scripts/inline-client-locale.mjs` **生成后内联**进 bundle，`--check` 会在内联副本过期时失败。
   单一事实来源 + 防漂移。
2. **`ctx.locale.bind(ns)` 返回的函数在「调用时」解析快照**，不是在绑定时。所以 `apply()` 只绑一次、
   再 `subscribe` 一下，用户在设置里切语言就能立刻生效，不需要重新绑定或刷新。
3. **没有 locale 服务时回退到内置中文表**（测试桩、精简构建），而不是渲染出 `card.install`。
   同理，服务命名空间里没有的键也会回退到内置字典 —— 部分注册不会让界面漏出键名。

数字与日期在**调用点**按当前语言格式化后再传进字典，所以字典项不需要知道分组分隔符或日期顺序。

### 键扫描器为什么要单独自测

`i18n-key-audit` 的收集规则被写错过**两次**，两次都给出错误答案：

- 第一版只匹配 `t('…')`，漏掉了**表格里定义、之后经变量翻译**的 6 个 `tab.*` 键，
  于是抽屉页签在屏幕上显示成 `tab.overview`。
- 第二版改成扫描 `t(…)` 的实参跨度，结果更糟：文件里有一大块 CSS 模板字符串和带撇号的英文注释，
  任一个都会让扫描器丢掉字符串状态，吞掉上万字符，把槽位名 `sidebar.panellist` 报成缺失的翻译键。

最终方案是**严格的形状扫描**：每段以小写字母开头、不含连字符。这天然接受
`tab.overview` / `misc.vendorKeen`，也天然拒绝 `i-arrow-up-circle`（图标名）、`sm-md-frame`（类名）、
`application/json`。代价是槽位名 `sidebar.panellist` 需要**具名放行** —— 一个可审计的例外，
胜过一个松到会给出错误答案的规则。

`../scripts/i18n-keys-check.mjs` 对两个方向都做断言（该抓的抓到、不该抓的不抓），
并在真实 bundle 上验证 `tab.*` 确实被收集到、`sidebar.panellist` 确实被排除。
**一个抓不到目标的检查器比没有检查器更糟**，所以规则本身也要被检查。

## 踩过的坑（重要）

1. **不要把 `styles` 当全局用。** 动态客户端 bundle 是 classic script，只能拿到
   `window`、`document`、`require` 三个东西 —— 这个版本的 web shell 里
   **没有 `styles` 这个自由全局**。写成 `styles.insert(CSS)` 会在 `apply()` 里抛
   `ReferenceError`，插件的 fiber 变成 `failed`，然后把**整个 Web 启动**拖挂。
   正确做法是 kernel 已经支持的那套：自己 `document.createElement('style')` 插进
   `head`，kernel 的 `claimStyles` / `removeOwnedStyles` 会按插件认领并在卸载时清掉
   （见 `client.js` 的 `insertStylesheet`）。
   > 教训：三个离线 harness 一开始都把 `styles` 当成参数注入了，于是全都"通过"。
   > 现在它们**故意不提供** `styles`，任何多余的全局访问都会在本地就炸出来。
2. **一个客户端插件激活失败 = 整个 Web 启动失败。** 桌面端会弹出
   「应用无法启动或已意外停止」并写出
   `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`，
   日志里的 `@montersy123/dsh-skill-market: failed` 就是 `entries.start` 的激活审计结果
   （`s.fiber.state === FAILED`；缺 bundle 才是 `import failed: …`）。
   所以**改动客户端代码后，先在离线脚本里过一遍 boot 审计 + 真实 Cordis 运行时**。
3. **不要在 Agent 运行期间重启 App。** 这个会话本身跑在同一个 Harness 进程里；
   重启 = 会话中断。流程应该是：离线验证全绿 → 告诉用户可以重启 → 用户自己重启。
4. **不要拿用户的启动流程做二分定位。** 先用一个最小探针插件（几十行、只注册两个
   slot）确认「这个包的客户端插件到底能不能被加载」，再上全量 UI：
   探针通过就说明接线没问题，问题一定在自己的代码里。
5. **页面来源是 `dsh-app://app/`，不是 `http://127.0.0.1:19387/`。** 桌面端
   Electron 的 `protocol.handle('dsh-app', …)` 把**非静态资源**路径转发到 Host
   并带上鉴权 cookie，所以同源相对路径能拿到 Host 路由；`/plugins/*` 在你从 shell
   直接 curl 时会 404（那是 SPA 静态回退），这不代表页面拿不到 bundle。
   插件内请求一律用 `document.baseURI` 解析（见 `client.js` 的 `apiPath`），
   这也是 `dshmarket` 在反代前缀场景下的既有约定。
6. **新装/新修的客户端插件第一次装载只能靠启动。** bundle 行写在启动时的
   `window.__DSH_BOOT__` 里，页面刷新补不上；但在 设置 → 插件 里启用一次会让它
   当场（热）加载。
7. **一个坏 provider 候选会把整个技能目录打挂，不是只跳过它自己。**
   `ctx.skills` 的注册表用 `validateCandidate` 校验 provider 返回的每个候选，
   而这个校验抛出的错误会**穿过 `ctx.skills.list()` 冒到调用方** —— 于是连
   Harness 内置技能在内的**全部技能一起消失**。校验字段（从 `dsh-skill` 源码读出）：

   | 字段 | 要求 |
   |---|---|
   | `name` | 字符串且 kebab-case |
   | `description` | 非空字符串 |
   | `invocation` | 缺省可以；给了就必须是 `{modelInvocable: boolean, userInvocable: boolean}` |
   | `rank` | 有限数字（**漏了必炸**） |

### 安装时也要校验 `name`，因为上游确实会写错

注册表是在技能**被加载时**才校验 `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`。所以一个
`SKILL.md` 里写着 `name: Playwright (Automation + MCP + Scraper)` 的包会**安装成功、占住目录、
然后永远不出现在任何会话里** —— 用户看到的是"我装了个技能但用不了"，像是插件坏了。

**这不是假设。** 实测同一个发布者（`user_3c6cb52e`）下多个技能都用中文显示名当 `name`：

| 上游 `name` | 是否合法 |
|---|---|
| `playwright-skill` | ✅ |
| `playwright-stealth` | ✅ |
| `Playwright MCP 浏览器自动化` | ❌ 中文 + 空格 |
| `用于浏览器自动化的 Playwright MCP 服务器` | ❌ |
| `Playwright Python 浏览器自动化库用于跨浏览器测试` | ❌ |

所以 `installSkill()` 现在和 `importLocalSkill()` 走**同一个** `assertSkillName()`，用的是
**从注册表抄来的同一条正则**（之前导入路径写的是自己那版宽松的 `/^[a-z0-9][a-z0-9-]*$/`，
允许大写与 `a--b`，和真实规则不一致）。失败时删掉暂存目录，磁盘上不留一个永远加载不了的东西。

错误文案里写明**这是发布方的问题**，因为用户的第一反应会是"你的插件坏了"：

```
该技能包的 SKILL.md 里 name 不是 kebab-case（只允许小写字母、数字、单个连字符）：
Playwright MCP 浏览器自动化。这是发布方的问题，Harness 会忽略这个技能文件。
```

`route-check.mjs` 里有一条**真实安装**断言（`user_3c6cb52e` 的那个包），因为这条检查的价值
就在于"正则确实作用在从上游拿到的字节上"——只测正则本身证明不了它被接上了。
   | `source` / `provider` | 非空字符串，且 `provider` 必须等于注册时的 `provider.name` |
   | `path` | 给了就必须是字符串 |

   `get()` 返回的定义还会再过一遍 `validateDefinition`。**provider 的 `list()`
   和 `get()` 永远不要抛**：读不到目录就返回空数组。
   `../scripts/skills-provider-check.mjs` 用真实注册表跑这些契约，
   `../scripts/candidate-contract-demo.mjs` 演示坏候选如何毒掉整份清单。
8. **`ctx.skills.register()` 不给 `source` 兜底，`provider` 和 `invocation` 才兜底。**
   而 `validateDefinition` 在 `get()` 时要求 `source` 是字符串 —— 少了它，
   「技能存在但一加载就抛」，症状和坏候选一样难查。注册时字段要写全。
9. **测试里不要用 `dispatchEvent(new Event('change'))` 触发 React 的受控复选框** ——
   React 18 对「`checked` 不是由合成 click 改变」的 change 事件不做处理，
   于是 `onChange` 根本不跑，看着像产品 bug。用 `.click()`。
   （我在这上面误判过一次，靠 `requestLog` 才定位。）
10. **注册表里有技能 ≠ 模型能看到技能。** 必须有人「渲染目录」——
    `@deepseek-ai/dsh-tool-skill` 才是那个消费者，它同时提供目录消息和 `skill` 工具。
    这个 profile 里它是**关着的**，所以本插件装了、注册了、文件也落盘了，
    **模型仍然什么都看不到**，用户看到的症状是「装了没反应」。
    验证方法最直接：`cordis_inspect_query` 的 `host/Tool/listTools`
    —— 如果返回里**没有 `skill`**，那就是缺第 ③ 层，跟安装机制无关。

## 待重启提示（面板里的「待生效」）

技能启停是**当场生效**的：Host 侧移动目录 + 让 `ctx.skills` 的注册与磁盘一致。
但**已经打开的那个对话**在创建时就固定了自己的工具集与技能目录，所以那个对话里的
模型不一定马上知道变化 —— 它要等 Harness 重启。

面板对此的处理是**提示，不是门槛**：

- 每次安装/启用/停用/**卸载**，把该技能记进待生效集合；
- 文案**只有一句话，toast 和横幅都是**：「重启 DeepSeek Harness 后生效」。
  用户明确要求只留这一句 —— 不做「本会话立即可用/已移除」这类面板无法保证的承诺，
  也不写「为什么」的长解释；
- 横幅标题是「本次改了 N 个技能」，正文是那一句，右侧**「知道了」可随时清掉**；
- 受影响的行动作区显示「待生效」小标签；
- **不禁用任何控件**：可以接着改别的技能，改完再一次性重启。

### 卸载也需要这条提示（曾经漏掉）

卸载**和安装同理**：技能文件删了，但正在运行的对话仍持有创建时的技能目录，于是那个技能**继续可用** ——
面板却报告"已卸载"什么都没说，用户以为关掉了，实际还在。现在卸载同样 `markPending()` 并提示重启。

一个细节：`markPending()` 的键是**目录名**，而卸载后那一行已经消失。这不影响横幅（它只数数量），
但意味着**提示只存在于 toast 与横幅里**，没有行内「待生效」标签可依附 —— 所以那一句必须出现在 toast 上。

`render-panel.mjs` 断言的是四件事：toast 提到重启、toast 点名了技能、横幅计数 +1、
以及待生效集合真的写进了存储（含被卸载技能的目录名）。

### 提示的有效期：以 **Host 进程的启动时间** 为界

第一版把待生效集合只写进 `localStorage`，于是**重启后提示还在** —— `localStorage`
恰恰是**跨重启存活**的，而它请求的那次重启已经发生了。当时的修法是用
`sessionStorage` 补一个标记，把"有效期"近似成"本次浏览会话"：刷新保留、关窗即清。
那是个**替身**——`localStorage` 分不清刷新与重启，而"窗口"是当时能拿到的最接近的东西。

现在这份文档在文件里，可以记下真正的判据：**做出改动时那个 Host 进程的启动时间**。
`GET/POST /state` 每次都返回 `harnessStartedAt`（`Date.now() - process.uptime()`，进程内恒定），
`writePending()` 把它写进 `pending.since`：

| 场景 | `since` 与当前 Host | 结果 |
|---|---|---|
| 刷新页面 | 相同 | 继续提示 —— 改动对当前对话仍未生效 |
| 关窗再打开（Host 未重启） | 相同 | 继续提示 —— 它请求的重启**确实**还没发生 |
| 重启 Harness | 不同 | 提示消失，并把陈旧的 `dirs` 从文件里清掉 |

这比"新窗口"更诚实：边界是提示**真正关心的那个事件**，而不是一个代理。唯一的行为差异是
"只关窗、不重启 Harness"现在仍然提示 —— 那正是实情（正在运行的对话仍持有旧的技能目录）。

`readPending()` 在读的时候也做一次同样的判定（hydration 已经清过一次，这是第二道），
`writePending()` 在集合清空时把 `pending` 归零。`../scripts/restart-advice-check.mjs`
把三种生命周期钉住：改动后记录到当前 Host 时间 → 同一个 Host 重载仍显示 →
Host 启动时间变晚则消失**且文件被清干净**。

> 这段文案改过一次没生效，原因值得记：用户说的是**横幅**，我只改了 **toast**。
> 两个地方各写一份同样的字，就会各错一次。

**页面为什么不能自己重启**：`webServer` 的能力只有 `register` / `registerUpgrade` /
`registerFallback` / `tapIndex` / `renderIndex`，没有重启。桌面端 Host 是 Electron 的
子进程，只有 shell 能重启它 —— `dshmarket` 的桌面模式同样把 `allowRestart` 置为
`false`，注释是「the shell remains responsible for restart in this mode」。
既然面板重启不了，就不该给一个「复制重启说明」按钮假装能帮上忙，那句话本身就是全部。

## 本地账本要在挂载时对齐 Host

面板把「已安装」清单存在 `data/panel.json`（以前是 `localStorage`），它是**缓存**，所以会以
面板不该展示的方式过期：旧安装根目录写下的路径、上一版本的文件数、在面板之外被删掉的技能。

挂载时 `GET /skill-market/api/installed` **以 Host 为准**校正：按目录名匹配、采用 Host 的
`directory` / `name` / `files` / `bytes` / `installedAt` / `origin`，并把 Host 已不认识的条目丢掉。
这是**重建**而不是打补丁 —— 早先只在已有条目上打补丁，于是 Host 知道、账本没有的技能永远不会
出现（本地导入的技能正是这种情况）。

这条是为了修一个真实症状：技能早在 `~/.dsh/skills` 里，面板却一直显示
`~/.dsh/skill-market/skills/...`（第一版的插件名包裹目录），因为客户端从不回头核对。

### 启用状态以**目录名**为键，并且每次挂载都重建

`enabled` 这张表描述的是「目录在哪」，所以它是**缓存**，有两个必须遵守的规则：

1. **键是目录名，不是 id。** 同一个技能在不同页面 id 不同（「已安装」里是 `@local/demo`，
   「本地导入」里曾是 `local-…`），用 id 当键会让两个视图对同一个目录给出不同答案。
2. **每次挂载由 Host 的答复重建，不做合并。** 合并会让上一次会话留下的条目继续压过 Host ——
   技能明明在技能根目录里，界面却标「已停用」，而另一个视图说它是启用的。

`render-panel.mjs` 断言两个视图对同一技能给出相同的启用状态，并真的来回切换一次
（关→开）确认请求里的目录名与状态都正确。

### 用户自己把技能目录复制进来

有人会直接用文件管理器把技能目录拖到这两个根目录之一。因为**位置就是状态**，两个目录各自
只有一个含义，所以这种情况无需额外机制：

| 复制到 | 含义 | 面板与注册表 |
|---|---|---|
| `$DSH_HOME/skills/` | **已启用** | 下一次 `sync()` 就发现并注册，无需重启 |
| `<state>/data/skills/` | **已停用** | 被发现，但不会出现在实时目录里 |

要求的正是这两条语义。`skills-provider-check.mjs` 的 5b 节专门断言它：手工写入技能根 → 被发现
且 `enabled === true` 且当场可用；手工写入停用库 → 被发现且 `enabled === false` 且不注册。

### 三种来源，`origin` 说了算

| `origin` | 怎么来的 | 出现在 |
|---|---|---|
| `local` | 通过「本地导入」上传的包，目录名是 `local--<name>` | 本地导入 + 已安装 |
| `market` | 本插件下载安装的 | 已安装（市场卡片显示「已安装 / 更新」）|
| `manual` | **用户自己放进去的目录** | 本地导入 + 已安装 |

区分 `market` 与 `manual` 的依据是**安装记录**：装过的目录一定有记录，没记录的只可能是人放进去的。
只凭目录名判断会把每个手工技能都归进 `market` —— 这正是它们在「本地导入」页看不到的原因。

### 目录名是**有损**编码，上游标识必须单独记录

**这是我最严重的一次架构错误。** 目录名是 `<handle>--<slug>`，而 `safeSegment` 会把 `[a-z0-9]`
之外的一切改写成 `-`。命名空间里**普遍含下划线**（`user_814dbe54`、`clawhub_spiceman161`、
`clawhub_root`），于是：

```
上游 namespace = user_814dbe54        →  目录 user-814dbe54--github
```

而详情请求是从**目录名反推** namespace 的，所以每次都问一个**不存在的命名空间**、拿回 404：

```
clawhub-root--find-skills    -> namespace=clawhub-root  slug=find-skills  HTTP 404
```

**症状**：所有下划线命名空间的技能，详情页打不开；「已安装」状态判定失效（没有更新按钮）。

修法是**把上游标识记进安装记录**，而不是从目录名反推：

```json
"user-814dbe54--github": { "version": "1.0.0", "at": …, "namespace": "user_814dbe54", "slug": "github" }
```

客户端侧同样要折一下：`installedEntryFor` 比较目录名时把 `_` 与 `-` 折叠，否则 catalog 技能
（`user_814dbe54`）永远找不到自己的账本行（`user-814dbe54--github`）。

#### 同一个错误犯了两遍：id 也要用 Host 的标识

第一版修完，详情页能开了，但**发现页仍显示"未安装"**。原因是我只改了"找账本行"的比较，
**没改 id 本身的构造**：

```
已安装行 id    = @clawhub-root/find-skills      ← 从目录名取 handle
catalog 卡片 id = @clawhub_root/find-skills      ← 用 upstream canonicalName
                  MATCH = NO
```

**最刺眼的是**：Host 在 `/installed` 里**已经给了**正确的 `handle` / `slug`，而挂载时的对账
**又从目录名拆了一遍**，把刚修好的信息丢掉：

```js
const [handle, ...slugParts] = directoryName.split('--')   // ← 覆盖了 host.handle
id: `@${handle}/${slugParts.join('--')}`
```

改法是 `host.handle` / `host.slug` 优先，目录名只作兜底。后果不止"显示未安装"：**账本行自己的 id
每次挂载都会被覆盖**，所以手动写进去的正确 id 也留不住。

> `render-panel.mjs` 的夹具命名空间不含下划线，**无法**表达这个形状，所以这条断言是**对源码**做的
> （`reconciliationUsesHostIdentity`）：要求 `host.handle`/`host.slug` 优先、id 由它们构造、
> 且不存在 `const [handle, ...slugParts] = directoryName.split('--')` 这种写法。
> 假装用夹具测到折叠或这个 id，都是自欺。

**已有的记录由 `repairInstallIdentity()` 在激活时修一次**，而且它**不能靠搜索**：

> 第一版用 catalog 的 keyword 搜索找 slug，这是错的 —— 那个端点**按热度排名**，
> 实测 `find-skills` 在**自己 slug 的前 20 条里都不出现**，于是在最需要修的那条记录上**静默失败**。

改成**逐个候选命名空间直接探测**详情端点，没有排名可以输：目录拼写、把 `-` 还原成 `_`、
再去掉连字符（`clawhub_root` 写出来是 `clawhub-root`，所以单靠一种还原不够）。搜索降级为最后兜底。
`route-check.mjs` 对两条路径都有断言，包括"探测只问详情端点、不问排名搜索"。

> 诊断这个问题的工具：`tools/repair-identity.mjs`（在真实记录上跑修复并打印 HTTP 状态）、
> `tools/find-skill.mjs`（在 200 条里按不同排序找一个 slug）、`tools/detail-path-check.mjs`
> （从目录名一路走到详情请求，指出哪一步断了）。

### 只有 `market` 有详情页

`local` 与 `manual` 的技能**不显示「详情」按钮**，点行本身也不会打开抽屉。抽屉的每一个页签讲的都是
SkillHub —— 发布者、版本历史、文件清单、安全扫描 —— 对一个只存在于本机的技能，这些要么是空的，
要么只能编。

`openDetail` 里也有一道守卫（防止将来新增入口漏掉），但按钮本身也**不渲染**：一个按下去毫无反应的
按钮，本身就是缺陷。

判定用 `origin`，不用 id：手工放置的目录由用户命名，`@libai/1.0.5` 这种 id 和已发布的技能长得**一模一样**，
按 id 判断会放它过去，然后每个详情请求都是 404 被包装成抽屉。`isLocalSkill(skill, origin)` 因此
**接受调用方手里的 origin**（「已安装」行持有 `entry.origin`），只在拿不到时回退到 id/handle。

`render-panel.mjs` 对三种情形都断言：面板导入（`@local/…`）、手工放置（`manual`）、以及市场安装
（**必须仍有一个「详情」按钮**，否则就是把功能整个删了而不是限定范围）。

### 目录名校验分两档，因为「谁命名的」不一样

| 用途 | 函数 | 规则 |
|---|---|---|
| **我们**给安装的技能命名 | `safeDirectoryName` | 只接受 `<handle>--<slug>` 的形状（`[a-z0-9-]`） |
| 用户手工放置的目录 | `safeExistingDirectoryName` | 只保证**路径安全** |

第二档是必须的：手工目录由用户命名，`libai-1.0.5` 就是一个真实例子 —— 它含点，而旧代码用第一档
校验它，于是点「停用」只会得到「技能名不合法」，可那个技能就明明白白列在列表里。

宽松的那档仍然拦住的，是真正会造成伤害的东西：路径分隔符、`..`、控制字符、Windows 保留名
（`CON`/`NUL`/`COM1`…），以及**结尾的点或空格**（Windows 会静默去掉它们，于是实际指向另一个文件）。
`disabled-target-check.mjs` 对含点目录断言能来回启停，并对 10 个应当拒绝的名字逐个断言。

面板侧还有一半：这类技能在存储里**没有账本记录**，所以它能否显示取决于对账是否
**由 Host 的答复重建**（见上一节）。只打补丁的实现会让它永远不出现。`render-panel.mjs` 断言
`handCopiedAppears` / `handCopiedChecked` / `handCopiedOnImportPage`（徽章为「手动放置」），
同一个目录名换到停用库后 `handParkedShowsDisabled` 必须反转。

### 下载数只在有数字时显示

`installs` 默认是 `0`，而「没有记录」和「确实是 0 次下载」看起来一样。所以这一项在数量 `<= 0`
时**整段省略** —— 打印一个没人测量过的数字，比留白更糟。本地导入的技能永远不显示它。

### 技能页地址不能直接用上游的 `homepage`

上游列表与详情都带一个 `homepage` / `sourceUrl`，值是 **`https://api.skillhub.cn/<ns>/<slug>`**。
那是 **API 主机**：浏览器请求它得到 `405 Method Not Allowed`，没有任何页面。把它放进「指标」页的
「主页」链接，用户点开只会失败。

公开站点是 SPA，**任何**路径都返回 200 与同一个外壳，所以状态码完全不能作为判据。实测
`indiv-ebandao/dev-expert`：

| 地址 | 结果 |
|---|---|
| `api.skillhub.cn/<ns>/<slug>` | 405，无 body |
| `skillhub.cn/<ns>/<slug>` | 200，**7076 字节外壳**，无技能信息 |
| `skillhub.cn/skills/<ns>/<slug>` | 200，**48293 字节**，`og:title` = 「编程专家.Skill - SkillHub」 |

所以公开路由是 `/skills/` + namespace + slug，由**标识符构造**而不是照抄字段；只有当年值指向
别的主机（发布者自己的站点）时才原样保留。判定工具是
[`../scripts/public-url-probe.mjs`](../scripts/dev/public-url-probe.mjs) —— 它先取一个**确定错误**的
路由作为"外壳基线"，再要求候选页面与基线不同，否则 `og:title` 的有无本身也会骗人。

## 「安全」标记：只有所有检测方都说安全才显示

发现页卡片与详情页的绿色盾牌「安全」来自上游的 `securityReports`。这个字段有四个必须记住的
事实，每一条都改变了实现（判定工具：`node ../scripts/security-probe.mjs [--links]`）：

**① 只在详情端点，且不在 `data.skill` 里。** 列表响应**完全没有**这个字段：

```
GET /api/skills            →  … verified, version          ← 没有 securityReports
GET /api/v1/skills/<slug>  →  { contentZhAvailable, latestVersion, namespace, owner,
                               securityReports, skill, slug }   ← 顶层才有
```

所以卡片要显示这个标记，就必须为每个技能单独取一次。为此加了 `GET /skill-market/api/skill-security`：
它复用同一份详情缓存，但只回 200 字节左右的判定结果。

**② 状态不止两种。** 实测 `benign` / `suspicious` / `queued`。「不是可疑」**不等于**安全 ——
排队中的扫描还没跑，把它算成安全就是在替没发生的检测背书。

**③ 检测方会互相矛盾。** 实测 `ima-skills`、`smart-charts`、`global-biblio-base` 都是
`keen=benign, sanbu=suspicious`。所以判定要求**每一个**检测方都是 `benign`：

| 判定 | 条件 | 是否显示「安全」 |
|---|---|---|
| `safe` | 至少一个检测方，且全部 `benign` | ✅ |
| `risk` | 任一 `suspicious` | ❌ |
| `pending` | 无 `suspicious`，但有 `queued` | ❌ |
| `unknown` | 上游什么都没说 | ❌ |

其余判定**不显示任何徽章** —— 连灰色的「未知」也不画。留白诚实地表示"没被检测过"，而一个灰色
标签会让人以为面板有自己的判断。判定在 **Host** 侧算一次（`safetyVerdict`），两个视图读同一个答案。

**④ 它有独立的页签，而且叫「安全扫描」不是「安全」。** 详情抽屉现在是
「概览 / 文件 / 版本历史 / 权限 / **安全扫描** / 指标」六页，扫描的内容**只**在扫描页 —— 指标页只剩
计数与主页链接，留一份副本就是两处要同步的东西。

**名字本身就是一条设计约束**：一个叫「安全」的页签，在还没说任何话之前就已经在断言这个技能是安全的
了。叫「安全扫描」才是在命名这一页**放的东西**（扫描结果），而不是替它下结论。

页签带盾牌图标（六个页签里需要一眼找到），判定为 `safe` 时**只有盾牌变绿、标签保持中性**：

```css
.sm-tab.sm-tab-safe svg { color: var(--sm-ok); }   /* 只有图标 */
```

整个页签染绿同样会把这个标签变成断言（「安全扫描 ✔」），所以染色范围必须限定在图标上。
`render-panel.mjs` 直接断言 CSS 规则的选择器以 `svg` 结尾、且**不存在**给页签本身染色的规则 ——
jsdom 不会通过 `getComputedStyle` 解析样式表，所以断言的是承载它的那条规则。

`render-panel.mjs` 也改用**按文字**切换页签（`clickTab('指标')`）。原来按位置写（`nth-child(5)`），
插入扫描页后指标从第 5 位移到第 6 位，位置断言会**静默点到另一个页签**。反过来，按文字选择意味着
改个名字就会让查找失败 —— 所以 `safetyTabLabel` 把名字本身也断言住了。

**⑤ 检测方只有两家，而且代号要翻译成名字。** 扫了 12 页、240 个技能，`securityReports` 的键
**只有两个**：`keen`、`sanbu`。所以样式可以按"一行一家"写死，这是**量出来的**、不是猜的
（`node ../scripts/security-vendors.mjs`）。

中文名也是从检测方自己的报告里确认的：`keen` 的链接落在科恩实验室的威胁情报站（`tix.qq.com`），
`sanbu` 的报告 HTML 里自己就写着 `云鼎实验室`。

| 代号 | 显示名 | 报告地址 |
|---|---|---|
| `keen` | 科恩实验室 | `tix.qq.com` |
| `sanbu` | 云鼎实验室 | `static.cloudsec.tencent.com` |

每一行是「盾牌 + 检测方名 + 该方的结论 + 查看报告」，整行在 hover 时轻微高亮。**盾牌按行着色**：
某一家报 `benign` 就绿，否则保持中性灰。一行只负责陈述**这一家说了什么** —— 需要所有家都同意的是
抽屉顶部那个「安全」徽章，而这份列表正是**分歧变得可见**的地方（`ima-skills` 实测为
`keen=benign, sanbu=suspicious`：第一行绿、第二行灰）。

**未知代号仍然列出**，用代号本身当名字。把不认识的检测方丢掉，等于缩小了扫描范围、又**悄悄强化**
了那个「安全」徽章 —— 这与「宁可不显示，也不多说一句」是同一条原则的两个方向。`render-panel.mjs`
的桩里特意放了一个表里没有的 `future-lab`，断言它**必须出现**。

**⑥ 详情页不再有总结徽章。** 那个「安全 + 所有检测方均报告安全，无风险」的行已按需求移除：
既然每家各占一行、各自带着结论，再在上面放一个总的就等于把同一件事说两遍。「安全」二字现在只在
**发现页卡片**上。

**⑦ `reportUrl` 真的能打开。** 它们带 `q-sign-time` 签名参数，看着像会过期，但实测全部 200：
`keen` 指向威胁情报页，`sanbu` 指向该技能自己的评估报告。所以每一行右边是「查看报告」链接。
**没有 URL 时不给链接**（排队中的扫描就没有）—— 否则又是 `api.skillhub.cn` 那类"看着权威却打不开"
的链接。

### 一个连带的容量问题

卡片逐个取判定意味着**一屏 60 张卡片 = 60 次请求**，而缓存上限原本是 64 条。一个列表响应是
**97 KB**，一个详情只有 2.3 KB —— 所以 60 个详情会把卡片自己来自的那个列表挤出去，下一次滚动
又要重新拉。上限因此提到 512，并且客户端用 `SECURITY_CONCURRENCY = 6` 的窗口排队，而不是一次
开 60 个连接。

## 面板状态的两条持久化规则

两个 bug 都出在「把内存里的东西当成持久的」，记下来免得复发：

0. **「打开在哪」和「按什么排」都不持久化。** `view` 与 `sortBy` 是同一类东西：它们描述**这次进入**
   面板时看到什么，而不是用户的长期偏好。`view` 早就不存了（从侧栏进入永远落在发现页），
   `sortBy` 现在也一样 —— **发现页默认按下载量排序**，不记住上次的选择。

   之前 `sortBy` 会被 `writeState` 持久化，而 `readState()` 用 `...parsed` 覆盖默认值，
   于是回访用户看到的首屏排序**取决于上一次看不见的选择**。改法有两处，缺一不可：
   写状态时不带 `sortBy`，读状态时在 `...parsed` **之后**再显式写一次 `sortBy: DEFAULT_SORT`
   —— 只在 `emptyState()` 改默认值是**无效的**，因为展开会把它覆盖掉。

   类目（`category`）仍然持久化：那是偏好，不是"这次看到什么"。

1. **类目页签的可见性不能从当前页推导。** 原来
   `categories.filter((entry) => chipCounts.has(entry.key))`，而 `chipCounts` 是从
   `catalog.skills` 算的 —— 一旦筛选到某个类目，catalog 只剩该类目，其他页签全部消失。
   现在**始终渲染全部类目**，计数来自 Host 的 `GET /skill-market/api/category-counts`
   （服务端对每个类目发一次 `pageSize=1` 取 `data.total`，13 个类目约 600ms，走
   `fetchUpstream` 缓存）。计数是**类目总数**，不受当前筛选影响，`title` 里写明了这点；
   取不到计数时页签照常显示，只是没有数字。
2. **收藏必须连技能记录一起存。** 原来只存 id 数组，渲染时用 `findSkill(id)` 去内存
   `seen` Map 里解析 —— `seen` 重启即空，上游列表接口又不支持按 id 过滤，于是
   「收藏页重启后空白，直到下一次收藏/取消收藏」。现在 `savedSkills` 把完整记录
   （含 `iconUrl`、`installs`、`rating` 等渲染所需字段）一并持久化，并在挂载时种回
   `seen`。`saved` 仍是有序 id 数组（`Object.keys` 对整数样式的键会重排，不能用来保证
   「最新在前」的顺序）。

   解析只有**两层**：`resolveSaved(id)` 先查内存 catalog，再查 `savedSkills[id]`。
   解析不出来的 id 是**旧版本留下的孤儿**（那个版本只存 id 没有记录表），本插件**不做迁移、
   直接丢弃**：catalog 落地后（`status !== 'loading'`，避免在首页到达前误删）跑一次
   `prune`，把孤儿 id 从 `saved` 和 `savedSkills` 里一起清掉，并提示「已清理 N 个无法解析
   的旧收藏」。用户的决定是「旧的不行就删了」——所以这里刻意**没有**「用已安装账本兜底」
   或「按 id 回查上游补记录」这类补救层。

3. **`useMemo`/`useCallback` 的依赖不能只写它字面读到的东西。** 上面那条修好之后收藏页
   **仍然空白**，原因是：`resolveSaved` 通过 `seen` 这个 **ref** 取数据，而 ref 变更**不产生
   state 依赖**。首次渲染时 catalog 还没到，memo 算出 0 行并缓存；等 catalog 到了，
   `catalog` 不在依赖里、`resolveSaved` 引用也没变 → **memo 不重算**，永远 0 行。
   所以 `resolveSaved` / `installedRows` 的依赖里显式加了 `catalog`，纯粹为了让它们在
   catalog 变化时重算，body 并不读它。文章里这种写法看起来多余，删掉就会回到 bug。

`render-panel.mjs` 的回归断言：`chipsStableAcrossFilter`（切换类目后页签数量不变）、
`savedRowsAfterReload` / `savedRowNameAfterReload`（卸载并重新挂载面板后收藏仍在，这是模拟
页面重载的最小方式）、`featuredRowGone` / `sortValues` / `paySkillChipGone` /
`sectionHeadText`（下面那节删掉的东西确实没了、数量确实来自 API）。
`../scripts/legacy-saved-check.mjs` 覆盖**旧格式 store**（只有 `saved`、没有 `savedSkills`）的
两个用例：目录里确实没有那个 id 时 —— 不渲染、显示空状态、清理存储、给出提示、无 React 报错；
目录里有那个 id 时 —— 正常渲染且**不被误删**。另外两个用例（3/4）覆盖状态从 Web Storage
搬进 `data/panel.json` 的那次迁移，见前面「面板自己的状态也在这个目录里」。

## 懒加载（列表不再停在第一页）

第一页是 60 条，而 SkillHub 共有 17 万+，所以「滚到底就没了」是必须解决的。
现在按下拉到底部追加下一页，直到走完 `data.total`。

- **首屏 effect 只在查询变化时跑**，并**重置分页状态**：追加的页属于产生它们的那次查询，
  换类目/排序/关键词时直接丢掉，不与新结果集合并。
- **`loadMore()` 对同一页号幂等**（`loadingMoreRef` 守卫）：`IntersectionObserver` 可能在
  上一页还在路上时又触发一次，重复请求同一页会把每张卡都渲染两遍。
- **追加时按 id 去重**：上游是偏移分页，两次请求之间若插入一条，会有一行被挤进刚取的这页。
- **到底就撤掉「加载更多」**，脚注改成「已显示全部 N 个」；未到底时显示
  「已显示 M / N」。
- **没有 `IntersectionObserver` 也能用**：`jsdom` 就没有，所以脚注同时渲染一个
  「加载更多」按钮，观察器缺失时它就是唯一入口。

`render-panel.mjs` 的桩**按 `page` 返回不同的页**（fixture 只有一页，其余是合成行），
断言链路是 `60 → 120 → 130 → 到底`，并检查 `duplicateCardTitles === 0`。

> 写这条测试时踩了一个坑值得记：合成行最初只覆盖了 `id`，但面板的
> `normalizeSkill` 是从 **`namespace.canonicalName`** 推导 id 的，所以 60 行全被归一化成
> 第一页的 id，去重逻辑把整页丢光 —— 表现为「点了加载更多但卡片数不变」。
> 一开始看起来像产品 bug，实际是**测试桩造的数据不符合真实响应形状**。

## 按需求删掉的面板元素

四项都是明确要求，记在这里免得又加回去：

1. **「官方精选」整行**——`FeaturedCard` 组件、渲染分支、以及 `.sm-featured` /
   `.sm-feat-grid` / `.sm-feat-card` / `.sm-feat-badge` / `.sm-feat-foot` 的 CSS 全部删除
   （`.sm-feat-list` 保留：那是检视面板的「能力清单」，与精选无关）。
   删除时注意 `.sm-feat-grid` 在两条媒体查询里也出现过，漏删会留死规则。
2. **下拉里的「按名称」**——`SORTS` 现在只有 `score` / `downloads` / `stars` / `updated_at`。
3. **`pay-skill` 类目**——它不是主题而是上游的商业档位，`/api/v1/categories` 的
   `active` 标记并不排除它。客户端 `HIDDEN_CATEGORIES` 过滤词汇表与兜底列表，
   **Host 侧 `categoryCounts()` 用同一份集合过滤**，否则会给一个永不渲染的页签算出数字。
4. **数量口径**——原来标题旁写的是「本页 60 个 · SkillHub 共 178,017 个」，前半句是把
   **已加载页的大小**当成了数量（页大小 60），所以看起来永远不对。「全部」页签的计数
   犯的是同一个错（`catalog.skills.length`）。现在两处都用 `catalog.total`（API 的
   `data.total`）；标题旁在搜索或筛选状态下才补一句「（本页 N 个）」，因为那时总数和
   屏幕上看到的确实不同。

## 不要把技能写进提示词段落（一条被否掉的路）

第一版为了让「已打开对话里的模型也知道有哪些技能」，用 `ctx.systemPrompt.section()`
注册了一段自带列表。**这个方向被否掉了，实现也已删除**，记在这里免得再走一遍：


- 技能可见性属于**共享的技能目录**，不属于「每个对话各来一份」。插件自己在提示词里
  复述一遍，等于绕过目录机制、多出一份会和注册表漂移的副本。
- 用户的验收口径更严格：**没有就是没有**。停用之后，连「之前已经用过这个技能的对话」
  也应该读不到 —— 这要求**每次加载都去查当前注册表**，而不是把一份快照塞进上下文。
- 提示词段落还会永久留在会话历史里，停用之后那段文字仍然在那儿，正好违背上一条。

`systemPrompt` 这个服务的 `section()` / `context()` 是存在且可用的，只是**不该**用在这里。

## 待确认 / 后续

- 真实桌面 App 的布局、浅深色、窄窗口表现需要在页面里目视确认（见交付说明）。
- 安装进度目前只有「安装中…」一个态（Host 一次请求内完成下载，不回传逐文件进度）。
  技能包最大可到 64 MB，若实际遇到大包需要进度条，得改成流式响应 + SSE。
- 尚未做「检查更新」：SkillHub 的 `versions` 接口可用，但没有接进面板。
- **页面刷新（Ctrl+R）解决不了技能可见性。** 技能目录是 Host 侧数据，刷新只重建
  浏览器里那棵树。本插件现在用 `register()`，所以安装/启停**当场生效**；
  唯一还需要重启的情况是本插件自己升级了 Host 半代码。
- 已安装技能在 `$DSH_HOME/skills`。本插件的注册是**运行时注册**（`source: skill-market`），
  如果同时启用了内置 `dsh-skill-filesystem`，同一个技能会被两条路径发现：
  注册表的层内规则是**项目 > 运行时 > 用户**，所以运行时注册会赢，面板里的
  启用/停用仍然说了算；要完全交给内置提供方管理，就停用本插件的安装功能。
