# dsh-skill-market

[![npm version](https://img.shields.io/npm/v/@montersy123/dsh-skill-market)](https://www.npmjs.com/package/@montersy123/dsh-skill-market)
[![GitHub stars](https://img.shields.io/github/stars/montersy123/dsh-skill-market?style=social)](https://github.com/montersy123/dsh-skill-market)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A skill market for DeepSeek Harness: browse the skills on [SkillHub](https://skillhub.cn/skills?sortBy=score) and install them into Harness for real.**

[中文](README.md) · [Development notes](docs/development.md)

`dsh-skill-market` adds a **Skill Market** panel to the sidebar, turning SkillHub's catalogue into somewhere you can browse, filter, search, inspect — and **install from with one click**. An installed skill is an ordinary local skill: Harness's own skill system discovers it, it sits beside your hand-written skills, and it is callable from any conversation.

- **Discover** — the whole SkillHub catalogue, most downloaded first. Category filters, keyword search, lazy loading, and install straight from the card.
- **Installed** — what is on this machine. **Disable without uninstalling** (the directory moves to a parked store, where Harness cannot see it), update, or uninstall.
- **Saved** — a favourites list, kept on this machine only.
- **Local import** — drop in a `.zip` skill package, or copy a directory into the skill root yourself.
- **Details drawer** — six tabs: Overview, Files, Version, Permissions, Security, Metrics. The Files tab expands the real file tree and previews file contents; Version history can install any older release.

## Install

### From the Harness UI

Type `dsh-skill-market` into the **Add plugin** wizard's search box and click Install.

### With the `dsh` CLI

```sh
dsh plugin --profile desktop add @montersy123/dsh-skill-market
```

Update:

```sh
dsh plugin --profile desktop update @montersy123/dsh-skill-market@latest
```

You can also install straight from GitHub — the repository is already runnable ESM, so **there is no build step**:

```sh
dsh plugin --profile desktop add github:montersy123/dsh-skill-market
```

Then start the UI. **Installing a skill requires restarting DeepSeek Harness**: the files land on disk immediately, but a conversation carries the skill catalogue its agent was built with, so a newly installed skill becomes callable in **new** conversations. The panel says so in a banner and a toast, and does not block any control while it waits — change several skills, then restart once.

## Using it

| Where | What you get |
| --- | --- |
| **Discover** | The SkillHub catalogue: category chips carrying each category's **total**, keyword search, and cards showing downloads, rating, saves and the safety mark. |
| **Installed** | Every skill in the library: source, version, directory, file count, install time, plus the enable/disable switch and update/uninstall. |
| **Saved** | A favourites list on this machine, with one-click install. |
| **Local import** | Drop a `.zip`, or place a directory in the skill root — both are listed, and each is marked as which. |
| **Details drawer** | Six tabs. The **Security** tab lists every third-party scanner's verdict individually. |

### What "Install" actually does

The skill is really downloaded, unpacked and written to `$DSH_HOME/skills/<handle>--<slug>/`. That is **Harness's own** skill root, not a private directory of this plugin — which is exactly why an installed skill becomes an ordinary local skill: the built-in filesystem provider finds it, it sits beside your hand-written skills, and **disabling this plugin does not make it disappear**.

**"Disabled" is a location, not a flag.** Enabling and disabling move the directory between two roots, so where it sits on disk is always the truth. It also means you can do it by hand: copy a folder into `$DSH_HOME/skills` and it is enabled, copy it into the parked store and it is disabled. The panel recognises both.

### Security

SkillHub scans every skill with several third-party scanners. **The panel shows the green "Safe" mark only when every scanner reports safe** — measured, they disagree often, so a single suspicious verdict means no mark at all rather than a grey one. Showing nothing honestly means "no verdict", whereas a grey chip implies the panel has an opinion.

The Security tab lists each scanner's verdict and report link in its own row, so a disagreement is visible instead of being flattened into one conclusion.

## Language

The UI is **bilingual (Chinese and English)**, following DSH's own **Settings → General** language setting; the panel deliberately has no second switch for it. Every string has both languages, and numbers and dates are formatted for the active language.

## Requirements

- DeepSeek Harness with the client plugin tree available (this plugin is a bundle: a `dsh.bundle` manifest plus a `cordis.patch.yml` layer).
- Node.js **>= 20** on the Host side.
- Network access to `api.skillhub.cn` for browsing and installing. Enabling, disabling and uninstalling do not need it.

## Good to know

- **Non-destructive about your data.** Nothing under `$DSH_HOME/skills` or the plugin's `data/` is pruned on startup; disabled and imported skills both survive a restart and a plugin update.
- **Only the destructive direction confirms.** Installing and updating do not prompt; **uninstalling** and **rolling back a version** do — they delete the directory, and undoing it means downloading again.
- **A count is only shown when there is one.** A missing download count is not rendered as `0`: that is what an unmeasured value looks like, and printing it states a fact nobody measured.
- **A package that is itself unusable is refused.** The registry validates the `name` field only when a skill is *loaded*, so a package declaring `name: Something With Spaces` would install quietly and then never appear. It now fails at install time, naming the publisher's mistake.

## Development

The development notes — the design contract, how each behaviour was measured, and the faults found along the way — are in [docs/development.md](docs/development.md) (Chinese); the upstream API notes are in [docs/skillhub-api.md](docs/skillhub-api.md).

The repository carries a self-check suite that needs no browser. After installing the plugin:

```sh
node scripts/install-plugin.mjs --apply   # pack and install into the profile
npm test                                  # the whole suite (29 checks)
```

`npm test` reports each check's exit code, and any failure fails the run. The rest are in [`scripts/`](scripts/),
with one-off investigation scripts archived under [`scripts/dev/`](scripts/dev/).

## License

[MIT](LICENSE) © 2026 montersy123
