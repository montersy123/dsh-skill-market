# dsh-skill-market

[![npm version](https://img.shields.io/npm/v/@montersy123/dsh-skill-market)](https://www.npmjs.com/package/@montersy123/dsh-skill-market)
[![GitHub stars](https://img.shields.io/github/stars/montersy123/dsh-skill-market?style=social)](https://github.com/montersy123/dsh-skill-market)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**DeepSeek Harness 的技能市场:浏览 [SkillHub](https://skillhub.cn/skills?sortBy=score) 上的技能,并把它们真的装进 Harness。**

[English](README.en.md) · [开发笔记](docs/development.md)

`dsh-skill-market` 在侧边栏加一个 **Skill Market** 面板,把 SkillHub 的技能库变成可以浏览、筛选、搜索、查看详情,并**一键安装到本机**的地方。装好的技能和手写的本地技能没有区别 —— Harness 自己的技能系统会照常发现它们,在任何会话里都能调用。

- **发现** — 整个 SkillHub 技能库,默认按下载量排序。分类筛选、关键词搜索、懒加载,卡片上直接安装。
- **已安装** — 本机上的技能。可以**停用而不卸载**(目录被移到停用区,Harness 就读不到了),也可以更新或卸载。
- **收藏** — 收藏夹只存在本机,用来记下想装的技能。
- **本地导入** — 把自己手头的 `.zip` 技能包拖进来,或者直接把文件夹拷进技能目录。
- **详情抽屉** — 六个页签:概览、文件、版本历史、权限、安全扫描、指标。文件页签能展开真实的文件树并预览内容,版本历史可以装回任意旧版本。

## 安装

### 从 Harness 界面安装

在 **添加插件** 的搜索框里填 `dsh-skill-market`,点安装。

### 用 `dsh` 命令行安装

```sh
dsh plugin --profile desktop add @montersy123/dsh-skill-market
```

更新:

```sh
dsh plugin --profile desktop update @montersy123/dsh-skill-market@latest
```

也可以直接从 GitHub 安装 —— 仓库里的代码就是可运行的 ESM,**不需要构建步骤**:

```sh
dsh plugin --profile desktop add github:montersy123/dsh-skill-market
```

装完启动 UI 即可。**安装技能后需要重启 DeepSeek Harness**:技能文件会立刻落到磁盘,但一场对话用的是它开始时就确定的技能清单,所以新装的技能在**新会话**里才能调用。面板会用一条提示条和一个 toast 说明这一点,并且不会因此锁住任何控件 —— 你可以一次改好几个技能,再重启一次。

## 用它

| 位置 | 能得到什么 |
| --- | --- |
| **发现** | 整个 SkillHub 库:分类 chips 按类目显示**总数**,搜索按关键词命中,卡片显示下载量、评分、收藏数与安全标记。 |
| **已安装** | 库里的每个技能:来源、版本、目录、文件数、安装时间,以及启用/停用开关与更新/卸载。 |
| **收藏** | 只在本机的收藏夹,带一键安装。 |
| **本地导入** | 拖放 `.zip`,或把目录直接放进技能目录 —— 两种都会列出来,并标明是哪一种。 |
| **详情抽屉** | 六个页签。**安全扫描**页签逐个列出第三方检测方的结论。 |

### 「安装」到底做了什么

技能会被真的下载、解包,写进 `$DSH_HOME/skills/<handle>--<slug>/`。这是 **Harness 自己的**技能根目录,不是插件的私有目录 —— 这正是装好的技能会变成一个普通本地技能的原因:内置的文件系统 provider 会发现它,技能列表里它和手写的技能并列,而且**停用这个插件也不会让它消失**。

**「停用」是一个位置,不是一个标记。** 启用和停用把目录在两个根目录之间移动,所以磁盘上的位置永远就是事实。这也意味着你可以自己动手:把文件夹拷进 `$DSH_HOME/skills` 就是启用,拷进停用区就是停用;面板两种都认。

### 安全扫描

SkillHub 用多家第三方检测方扫描每个技能。**面板只在所有检测方都报告安全时,才显示绿色的「安全」标记** —— 实测中检测方经常互相矛盾,所以只要有一家说可疑,就不显示任何标记(而不是显示一个灰色的)。不显示诚实地表示「没有结论」,而灰色 chip 会让人以为面板有自己的判断。

安全扫描页签逐行列出每家的结论和报告链接,所以分歧是看得见的,而不是被压成一个结论。

## 语言

界面是**中英双语**,跟随 DSH 自己的 **设置 → 常规** 里的语言设置,面板里不再放第二个开关。所有界面文案都有两份,数字和日期按当前语言格式化。

## 环境要求

- DeepSeek Harness,且客户端插件树可用(本插件是一个 bundle:`dsh.bundle` manifest + `cordis.patch.yml` 层)。
- Host 侧 Node.js **>= 20**。
- 访问 `api.skillhub.cn` 的网络。浏览和安装需要它;启用、停用和卸载不需要。

## 说明

- **不会动你的数据。** `$DSH_HOME/skills` 和插件的 `data/` 在启动时都不会被清理;停用的技能和导入的技能在重启与插件升级后都还在。
- **只有破坏性操作才二次确认。** 安装和更新不弹确认,**卸载**和**版本回退**会 —— 它们会删掉目录,要恢复得重新下载。
- **没有数字就不显示数字。** 缺少的下载量不会渲染成 `0`:那是「没测到」的样子,印出来就成了一个没人测过的事实。
- **包本身不合规就拒绝安装。** 注册表只在技能**被加载时**校验 `name` 字段,所以一个声明了 `name: Something With Spaces` 的包会安静地装进去然后永远不出现。现在这种包在安装时就会失败,并指出发布者的错误。

## 开发

开发笔记(设计契约、测量方式、踩过的坑)在 [docs/development.md](docs/development.md);上游接口笔记在 [docs/skillhub-api.md](docs/skillhub-api.md)。

仓库里带一套自检脚本,不需要浏览器就能跑。装了插件之后:

```sh
node scripts/install-plugin.mjs --apply   # 打包并装进 profile
npm test                                  # 整套自检(29 项)
```

`npm test` 会逐项打印退出码,任何一项失败都会让整体失败。其余脚本在 [`scripts/`](scripts/),一次性的调查脚本归档在 [`scripts/dev/`](scripts/dev/)。

## 许可

[MIT](LICENSE) © 2026 montersy123
