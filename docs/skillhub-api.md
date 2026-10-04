# SkillHub 接口清单（本插件用到的全部上游）

上游 origin：`https://api.skillhub.cn`（站点 `skillhub.cn` 的自己的前端也走这个 host）。
**所有接口都没有 CORS 头**，所以浏览器里直接 `fetch` 会被拦 —— 这就是本插件必须有一个
Host 侧代理的原因。

下面每条命令都实测过（Windows 上用 `curl.exe`，但都是标准 curl 参数）。

---

## 1. 技能列表 / 搜索 / 排序 / 分类筛选

```bash
curl -s "https://api.skillhub.cn/api/skills?page=1&pageSize=2&sortBy=score&order=desc"
```

**它的响应是包一层的**：`{ code, message, data: { skills, total } }` —— 注意
`total` 在 `data` 里，`code: 0` 表示成功。

实测：`data.total = 178201`，`data.skills[0].namespace.canonicalName = @indiv-ebandao/dev-expert`

参数（全部可选，本插件只发这些）：

| 参数 | 取值 | 说明 |
|---|---|---|
| `page` | 从 1 开始 | 偏移分页 |
| `pageSize` | 本插件用 60；插件侧上限 100 | |
| `sortBy` | `score` / `downloads` / `stars` / `updated_at` | `name` 已按需求移除 |
| `order` | `desc` / `asc` | |
| `keyword` | 关键词 | 搜索 |
| `category` | 分类 key | 见第 2 条 |

`data.skills[]` 里本插件用到的字段：`slug`、`name`、`version`、`downloads`、`stars`、
`score`、`updated_at`、`created_at`、`iconUrl`、`description` / `description_zh`、
`source`、`verified`、`isServiceized`、`category`、`labels.requires_api_key`、
`subCategories[].name`、`namespace.{handle,canonicalName,displayName}`。

---

## 2. 分类表

```bash
curl -s "https://api.skillhub.cn/api/v1/categories"
```

响应 `{ count, items }`，**没有每个分类的技能数量**（这是本插件另外做
`/category-counts` 的原因：对每个分类发一次 `pageSize=1` 只取 `data.total`）。

`items[]`：`{ key, level, version, name, nameEn, sortOrder, active }`

实测 13 个一级分类：`pay-skill, office-efficiency, content-creation, dev-programming,
data-analysis, design-media, ai-agent, knowledge-management, business-ops, education,
professional, it-ops-security, life-service`

> `pay-skill` 是商业档位而不是主题，本插件按 key 过滤掉它（`active` 标记不排除它）。

---

## 3. 技能详情（含概述来源、最新版本）

```bash
curl -s "https://api.skillhub.cn/api/v1/skills/dev-expert?namespace=indiv-ebandao"
```

响应 `{ contentZhAvailable, latestVersion, namespace, owner, securityReports, skill, slug }`

`skill` 字段：`slug, displayName, summary, summary_zh, overviewMd, iconUrl, category,
subCategories, tags, labels, source, sourceUrl, verified, isAuthorVerified,
authorVerifiedHandle, githubAuthorLogin, upstream_owner_login, upstream_url,
createdAt, updatedAt, last_synced_at, stats, ext, claim_state, claimable,
claimed_user_handle, isServiceized`

`latestVersion`：`{ changelog, createdAt, version }`

### ⚠️ 一个重要的实测结论：`overviewMd` 目前是空的

我逐个查了 12 个技能（含腾讯官方 `tencent-adm/tencent-docs`），**`skill.overviewMd`
全部是空字符串**（长度 0）。

**详情页的「概述」用的是技能包里的 `SKILL.md` 正文** —— 那正是 Harness 加载技能时读的
同一份文件，所以用户看到的就是装完后会运行的内容。实现上从第 5 条的清单里按大小写不敏感
匹配 `skill.md`，再用第 6 条取正文，剥掉 YAML frontmatter 后渲染 Markdown。

`skill.summary_zh` 是**列表级短描述**（实测 223–637 字），作为 `SKILL.md` 读不到时的回退，
两者不会同时当成「概述」展示。

---

## 4. 版本历史

```bash
curl -s "https://api.skillhub.cn/api/v1/skills/dev-expert/versions?namespace=indiv-ebandao"
```

响应 `{ namespace, slug, source, versions }`

`versions[]`：`{ version, versionId, changelog, createdAt, securityReports }`

实测 `dev-expert` 有 **62 条**历史，`changelog` 是作者真实填写的（例如
`"v2.1.5 - MIT license, 分类"`、`"连接 Beatra 更顺畅：授权助手会等你点…"`），
不是占位文本。

> 之前插件里写着「SkillHub 未公开逐版本更新日志」—— **那句话是错的**，这个接口就是。
> 现在版本页已经改成读它。

---

## 5. 文件清单（目录树的来源）

```bash
# 最新版
curl -s "https://api.skillhub.cn/api/v1/skills/dev-expert/files?namespace=indiv-ebandao"
# 指定版本（按版本安装就靠它）
curl -s "https://api.skillhub.cn/api/v1/skills/dev-expert/files?namespace=indiv-ebandao&version=2.0.1"
```

响应 `{ count, files, namespace, version }`

`files[]`：`{ path, sha256, size }`，**`path` 是扁平的 `a/b/c.md`，没有层级** ——
目录树是前端自己按 `/` 拆出来的。

**`version=` 是有效的**，实测 `dev-expert`：

| 请求 | 返回 |
|---|---|
| 不带 `version` | `version=2.0.3`, 84 files |
| `version=2.0.2` | `version=2.0.2`, 84 files |
| `version=2.0.1` | `version=2.0.1`, **83** files |
| `version=1.21.10` | `version=1.21.10`, **79** files |
| `version=9.9.9`（不存在） | **404** |
| `versionId=<id>` / `v=<ver>` | **被忽略**，仍返回最新 —— 只有 `version` 认 |

响应里的 `version` 是**实际返回的那个版本**，所以服务端可以据此报告「真的装了什么」。

---

## 6. 单个文件内容

```bash
# 最新版（必须 -L：这条是 302 到腾讯云 COS）
curl -sL "https://api.skillhub.cn/api/v1/skills/parenting-expert/file?path=README.md&namespace=indiv-ebandao"
# 指定版本 —— 同样有效，而且必须带，否则拿到的是最新版
curl -sL "https://api.skillhub.cn/api/v1/skills/dev-expert/file?path=SKILL.md&namespace=indiv-ebandao&version=2.0.1"
```

**必须加 `-L`**：不加只拿到 `<a href="…">Found</a>`。Node 的 `fetch` 默认跟随重定向，
所以代理里直接可用。

### ⚠️ 不带 `version` 会静默拿到最新版

这是**按版本安装最容易做错的地方**。实测 `dev-expert` 的 `SKILL.md`：

| 请求 | 字节数 | 与清单声明的 sha256 一致？ |
|---|---|---|
| `path=SKILL.md&version=2.0.2` | 15557 | ✅ **一致** |
| `path=SKILL.md`（无 version） | 15020 | ❌ 不一致 |

所以「装旧版本」如果不把 `version` 透传到**每一个文件**的下载上，就会把不同版本的文件
混进同一个目录，并且必然触发 sha256 校验失败（更糟的是校验被跳过时静默装错）。

失败形态：不存在的路径 → **404**；`path=../../etc/passwd` → **404**（上游自己挡住了
穿越；插件侧也再校验一次）。

### 详情页的「概述」用的是 SKILL.md

插件从第 5 条的清单里**大小写不敏感**匹配 `skill.md`，再用这条取正文，剥掉 YAML
frontmatter 后渲染 Markdown —— 也就是 Harness 加载技能时读的同一份文件。

---

## 7. 目前**没有**启用的接口

```bash
# 未使用：插件是整包下载后自己校验 sha256，不逐文件取
curl -s "https://api.skillhub.cn/api/skills?page=1&pageSize=1&category=office-efficiency"
```

（这条其实就是第 1 条带 `category` 的形态，插件用它取分类总数；列在这里是因为
`/category-counts` 实现对每个分类发的就是它。）

---

## 8. 明确不存在的接口（试过，别浪费时间）

| 试过的路径 | 结果 |
|---|---|
| `/api/v1/skills/<slug>/releases?namespace=` | **405** |
| `HEAD /api/v1/skills/<slug>/file?…` | **405**（只能 GET） |

---

## 9. 技能页地址：上游给的 `homepage` 打不开

列表与详情都带 `homepage` / `sourceUrl`，值是 **`https://api.skillhub.cn/<ns>/<slug>`** —— 也就是
**API 主机**。浏览器请求它得到 **405**，没有页面。公开站点是 SPA，任何路径都回 200 与同一个外壳，
所以状态码不能当判据。实测 `indiv-ebandao/dev-expert`：

| 地址 | 状态 | 字节 | `og:title` | 结论 |
|---|---|---|---|---|
| `api.skillhub.cn/<ns>/<slug>` | 405 | 0 | — | 上游给的那个，打不开 |
| `skillhub.cn/<ns>/<slug>` | 200 | 7076 | 无 | SPA 外壳 |
| `skillhub.cn/skill/<ns>/<slug>` | 200 | 7076 | 无 | SPA 外壳 |
| **`skillhub.cn/skills/<ns>/<slug>`** | 200 | 48293 | `编程专家.Skill - SkillHub` | **真正的技能页** |

判定脚本：`node .tools/public-url-probe.mjs [namespace] [slug]`。它先抓一个**确定错误**的路由作为
"外壳基线"，再要求候选页面与之不同 —— 否则「有 `og:title`」这种判据本身也会骗人。

---

## 插件侧对应的代理路由

浏览器不直连上游，全部走 Host 代理（前缀 `/skill-market/api`）：

| 插件路由 | 转发到 |
|---|---|
| `GET /skill-market/api/skills` | 第 1 条（白名单参数 + `pageSize` 上限 100） |
| `GET /skill-market/api/categories` | 第 2 条 |
| `GET /skill-market/api/skill-detail?slug&namespace` | 第 3 条 |
| `GET /skill-market/api/skill-versions?slug&namespace` | 第 4 条 |
| `GET /skill-market/api/skill-files?slug&namespace` | 第 5 条 |
| `GET /skill-market/api/skill-file?slug&namespace&path` | 第 6 条（取 `SKILL.md` 正文；`path` 走安装同款校验，超过 256 KB 只回 `truncated` 不回正文） |
| `GET /skill-market/api/category-counts` | 对每个一级分类发一次第 1 条取 `data.total` |
| `GET /skill-market/api/installed` | 本机，不转发上游 |
| `POST /skill-market/api/{install,uninstall,enabled}` | 本机 |

`slug` / `namespace` 在代理侧做白名单校验（`^[A-Za-z0-9][A-Za-z0-9._-]*$`），
含 `/`、`..`、`:` 一律 **400**，避免把代理指向别的上游路径；不合法时返回 400 而不是 502。
