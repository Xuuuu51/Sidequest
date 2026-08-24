<p align="right">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/readme/hero-dark.svg">
    <img src="./assets/readme/hero-light.svg" width="100%" alt="Sidequest——为 AI Coding 打造的项目记忆：现在记下旁支，稍后让 coding agent 接手">
  </picture>
</p>

<p align="center">
  <a href="#现在记下稍后接手">为什么选择 Sidequest</a> ·
  <a href="#一份项目记忆服务每个入口">工作方式</a> ·
  <a href="#开始使用">开始使用</a> ·
  <a href="#命令行">CLI</a> ·
  <a href="./docs/README.md">文档</a>
</p>

## 现在记下，稍后接手

AI Coding 总会暴露出一些值得处理、却不属于当前 prompt 的工作：重构机会、边界情况、体验改进，或需要以后验证的问题。

现在处理会让主目标偏航，留在聊天记录里又很难在另一个 session 找回。Sidequest 让这些旁支在所属项目中安静等待。

1. 在任意应用中按下 <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd>。
2. 立即记录，不必停下来组织。
3. 时机合适时，让 coding agent 找到这条 Quest 并接手。

```text
今天
  “Quest 详情应该支持键盘导航。”
  → 已保存到当前项目

稍后的 AI Coding 会话
  你：找到键盘导航相关的 Sidequest，然后实现它。
  Agent：找到了。我先检查 Quest 详情的交互流程。
```

通过 Desktop 管理的 Codex 与 Claude Skill，自然语言回忆现在已经可用。Sidequest 为 agent 提供稳定的项目记忆查询与管理方式；它不会自动调度 agent，也不会自动执行 Quest。

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="AI Coding 中发现的旁支通过快速记录保存为项目内 Markdown，稍后由 coding agent 查询并接手">
</p>

## 看见项目，而不是又一个任务管理器

![Sidequest macOS 应用：左侧为多个项目，中间为 Inbox、Ready 和 Done 看板，右侧为可编辑的 Quest 详情抽屉](./docs/assets/sidequest-application-shell-dark-v6.png)

Sidequest 刻意只处理项目级开发意图：

- **不切换上下文也能记录。** Quick Capture 始终位于当前应用上方，几秒内保存，再把焦点还给正在进行的工作。
- **准备好时重新判断。** 浏览和搜索当前项目的 Quest，让它们在 `Inbox`、`Ready` 与 `Done` 之间流转。
- **把工作重新交给 agent。** 安装后的 Codex 或 Claude Skill 可以响应自然语言请求，回忆和管理 Quest。
- **始终拥有自己的记忆。** 每条 Quest 都是文件系统中的普通 Markdown 文件——不需要账号、数据库、后台服务或云端依赖。

Sidequest 面向长期在本地代码项目中工作的个人开发者。它不是团队 Issue Tracker，也不是通用待办应用。

## 一份项目记忆，服务每个入口

Quick Capture、Desktop App、`sq` CLI 和 coding-agent Skill 都通过同一个 Rust Core 工作。存储、校验、Workspace 解析、搜索与安全写入因此只有一份实现和一个 Source of Truth。

对你来说，与 agent 的交互依然是自然语言：

```text
“列出和键盘导航有关的 Sidequest。”
“接手那条无障碍 Quest。”
“把那条 Quest 标记为完成。”
```

在底层，安装的 Skill 使用有版本约束的 machine-readable CLI，而不是直接读取隐藏文件或调用私有服务：

```bash
sq --json search "keyboard navigation"
sq --json show sq_01KABC1234567890ABCDEFGHJK
sq --json status sq_01KABC1234567890ABCDEFGHJK done
```

[`sq` CLI 契约](./docs/contracts/cli.md)定义了脚本和 coding agent 使用的稳定参数、JSON 结构、错误与退出码。

### 文件是 Source of Truth

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

Quest 详情应该支持键盘导航。
```

这些文件易于迁移、检查和备份；如果你愿意，也可以自然地跟随项目进入 Git。Sidequest 绝不会替你执行 `git add`、`git commit` 或 `git push`。

## 当前包含

- 多项目 macOS Desktop App
- 全局置顶的 Quick Capture Window
- 包含 `Inbox`、`Ready` 与 `Done` 的 Quest 看板
- 当前项目搜索与可编辑的 Quest 详情
- 项目内 Markdown 存储与安全原子写入
- 损坏文件隔离，单条损坏 Quest 不会阻塞整个 Workspace
- 同时提供 human-readable 和稳定 JSON 输出的原生 `sq` CLI
- 由 Desktop 管理的 Codex 与 Claude Skill 集成

## 开始使用

> **早期 macOS MVP：** Sidequest 目前需要从源码运行，尚未确认提供签名公开版本与自动更新。

### 环境要求

- 安装了 Xcode Command Line Tools 的 macOS
- Node.js 24
- pnpm 11.7 或 11.x 系列的更高版本
- Rust 1.98.0

克隆仓库并启动 Tauri Desktop App：

```bash
git clone https://github.com/Xuuuu51/Sidequest.git
cd Sidequest
pnpm install
pnpm desktop
```

首次运行时添加一个项目，并选择是否配置 Quick Capture 与 coding-agent 集成。应用可以替你安装内置的 `sq` CLI，以及由其管理的 Codex 或 Claude Skill。

## 命令行

如果希望独立于 Desktop App 使用 CLI，可以通过 Cargo 安装：

```bash
cargo install --path crates/cli
```

然后初始化项目并记录第一条 Quest：

```bash
sq init /path/to/project
cd /path/to/project

sq add "处理只读 Workspace 状态"
sq list
sq search "Workspace"
```

```text
sq init      初始化 Sidequest Workspace
sq add       记录一条新 Quest
sq list      列出活跃 Quest
sq show      查看一条 Quest
sq search    搜索当前项目
sq update    修改 Quest 内容
sq status    在不同状态间移动 Quest
sq delete    删除一条 Quest
```

脚本和 coding agent 通过 `sq --json <COMMAND>` 使用有版本约束的 machine-readable 接口。

## 范围

MVP 刻意保持小而明确。它不包含 Windows 或 Linux App、云同步、团队协作、外部 Issue Tracker 集成、Semantic Search、自动执行 Quest，也不会自动识别当前 IDE、Terminal 或聊天对应的项目。

完整产品边界见 [MVP Scope](./docs/product/mvp-scope.md)；产品、契约、架构、Desktop 行为与交付文档的入口见[文档导航](./docs/README.md)。

## 开发

| 领域 | 技术 |
| --- | --- |
| Core | Rust |
| CLI | Rust + clap |
| Desktop | Tauri 2 + React + TypeScript |
| Server State | TanStack Query |
| UI State | Zustand |
| Storage | Markdown + YAML Frontmatter |

开发过程中启动 Desktop App：

```bash
pnpm install
pnpm desktop
```

在 Workspace 根目录运行常用检查：

```bash
pnpm format:check
cargo clippy --workspace
cargo test --workspace
pnpm lint
pnpm typecheck
pnpm test
```

请从[文档导航](./docs/README.md)开始阅读。[架构总览](./docs/architecture/overview.md)、[稳定契约](./docs/contracts/)与[验收清单](./docs/delivery/acceptance.md)分别说明实现边界和完整交付门槛。

## License

Sidequest 使用 [MIT License](./LICENSE)。
