<p align="right">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/readme/hero-dark.svg">
    <img src="./assets/readme/hero-light.svg" width="100%" alt="Sidequest——在不中断当前开发流的前提下，保存旁支想法的本地优先项目记忆层">
  </picture>
</p>

<p align="center">
  <a href="#专注主线不丢旁支">为什么选择 Sidequest</a> ·
  <a href="#工作方式">工作方式</a> ·
  <a href="#开始使用">开始使用</a> ·
  <a href="#命令行">CLI</a> ·
  <a href="./docs/README.md">文档</a>
</p>

![Sidequest macOS 应用：左侧为多个项目，中间为 Inbox、Ready 和 Done 看板，右侧为可编辑的 Quest 详情抽屉](./docs/assets/sidequest-application-shell-dark-v6.png)

<p align="center"><sub>一个项目，三种状态。每个想法都留在启发它的代码旁边。</sub></p>

## 专注主线，不丢旁支

开发一个功能时，你常常会顺手发现另一件值得做的事：一次重构、一个边界情况、一处体验改进，或一项值得后续验证的工作。

立刻处理会打断当前节奏；项目管理工具又显得太重；聊天记录难以重新发现，而代码 TODO 往往也不适合承载项目级意图。

Sidequest 为这些想法提供一个安静等待的位置：

- **几秒完成捕获。** 在任何应用中按下 <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd> 打开 Quick Capture，写下想法，然后继续当前工作。
- **回到项目语境中回忆。** 浏览和搜索当前项目的 Quest，并让它们在 `Inbox`、`Ready` 与 `Done` 之间流转。
- **始终拥有自己的数据。** 每条 Quest 都是文件系统中的普通 Markdown 文件——不需要账号、数据库、后台服务或云端依赖。

Sidequest 面向长期在本地代码项目中工作的个人开发者。它不是团队 Issue Tracker，也不是通用待办应用。

## 工作方式

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="Quick Capture、Desktop App、CLI 和 Coding Agent 通过同一个 Rust Core 与本地 Markdown 存储完成 Quest 的捕获和回忆">
</p>

Desktop App、`sq` CLI，以及已安装的 Codex 或 Claude Skill 都通过同一个 Rust Core 工作。因此，存储、校验、Workspace 解析、搜索与安全写入只有一套实现，不会为每个入口维护另一份 Source of Truth。

### 文件就是 Source of Truth

每条 Quest 都是所属项目中的一个可读文件：

```text
your-project/
└── .sidequest/
    └── quests/
        └── sq_01KABC1234567890ABCDEFGHJK.md
```

```markdown
---
created_at: 2026-08-22T22:30:00+08:00
status: inbox
---

处理只读 Workspace 状态。
```

这些文件易于迁移、检查和备份；如果你愿意，也可以自然地跟随项目进入 Git。Sidequest 绝不会替你执行 `git add`、`git commit` 或 `git push`。

## 开始使用

Sidequest 目前是一个早期 macOS MVP，需要从源码运行。

### 环境要求

- macOS 与 Xcode Command Line Tools
- Node.js 24
- pnpm 11.7 或更高的 11.x 版本
- Rust 1.98.0

克隆仓库并启动 Tauri Desktop App：

```bash
git clone https://github.com/Xuuuu51/Sidequest.git
cd Sidequest
pnpm install
pnpm desktop
```

首次启动时，添加一个项目，并选择是否配置 Quick Capture 与 Coding Agent Integration。应用也可以为你安装随附的 `sq` CLI。

## 已包含功能

- 支持多项目的 macOS Desktop App
- 包含 `Inbox`、`Ready` 与 `Done` 的 Quest 看板
- 全局唤起、始终置顶的 Quick Capture Window
- 当前项目搜索与可编辑的 Quest Details
- 安全的原子写入与损坏文件隔离
- 同时提供人类可读输出和稳定 JSON 输出的原生 `sq` CLI
- 由应用管理的 Codex 与 Claude Skill Integration

## 命令行

如果希望脱离 Desktop App 单独使用 CLI，可以通过 Cargo 安装：

```bash
cargo install --path crates/cli
```

然后初始化项目并捕获第一条 Quest：

```bash
sq init /path/to/project
cd /path/to/project

sq add "处理只读 Workspace 状态"
sq list
sq search "Workspace"
```

```text
sq init      初始化 Sidequest Workspace
sq add       捕获一条新 Quest
sq list      列出活跃 Quest
sq show      查看一条 Quest
sq search    搜索当前项目
sq update    修改 Quest 内容
sq status    在不同状态间移动 Quest
sq delete    删除一条 Quest
```

脚本与 Coding Agent 可以通过 `sq --json <COMMAND>` 使用带版本的机器可读接口。[`sq` CLI Contract](./docs/contracts/cli.md) 定义了参数、JSON 结构、错误与 Exit Code。

## 范围

MVP 刻意保持小而明确。它不包含 Windows 或 Linux App、云同步、团队协作、外部 Issue Tracker Integration、Semantic Search 或自动执行 Quest。当前也没有已确认可用的签名公开版本与自动更新。

精确产品边界见 [MVP Scope](./docs/product/mvp-scope.md)。产品、Contract、架构、Desktop 行为与交付文档的入口见[文档导航](./docs/README.md)。

## 开发

| 领域 | 技术 |
| --- | --- |
| Core | Rust |
| CLI | Rust + clap |
| Desktop | Tauri 2 + React + TypeScript |
| Server State | TanStack Query |
| UI State | Zustand |
| Storage | Markdown + YAML Frontmatter |

在 Workspace 根目录运行常用检查：

```bash
pnpm format:check
cargo clippy --workspace
cargo test --workspace
pnpm lint
pnpm typecheck
pnpm test
```

完整 Release Gate 与人工 Smoke Test 要求见[验收清单](./docs/delivery/acceptance.md)。

## License

Sidequest 使用 [MIT License](./LICENSE)。
