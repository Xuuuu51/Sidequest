# MVP Scope

> 状态：实现基线  
> 平台：macOS

本文只定义 MVP 包含什么、不包含什么。行为细节由对应产品文档负责，数据和接口细节由 Contracts 负责，验收场景由 [Acceptance](../delivery/acceptance.md) 负责。

## 目标

MVP 验证：

- 用户是否会跨 coding session 持续捕获 Quest。
- 用户是否能重新浏览和搜索项目中的 Quest。
- 纯文件存储是否足够可靠、可读和 Git-friendly。
- `sq` CLI 是否足以作为 Coding Agent 的稳定协议。

## 包含

### Product

- macOS Desktop App
- Main Window
- 独立 Quick Capture Window
- 多项目列表与当前项目 Board
- Quest Details Drawer
- 当前项目内搜索
- Settings

Desktop 的具体行为见 [Desktop Product](../desktop/product.md)。

### Core 与 Storage

- Rust `sidequest-core`
- 项目内 Markdown storage
- Workspace initialization 与 resolution
- Quest lifecycle 与 search
- 损坏文件隔离和安全写入

稳定规则见 [Quest Storage Contract](../contracts/quest-storage.md) 和 [Workspace Contract](../contracts/workspace.md)。

### CLI 与 Agent

- Rust `sq` CLI
- Human-readable 与 stable JSON output
- Codex Skill
- Claude Code Skill
- Desktop 管理的 CLI / Skill 安装

接口见 [CLI Contract](../contracts/cli.md)，安装与所有权见 [Distribution Architecture](../architecture/distribution.md)。

## 不包含

### Platform

- Windows
- Linux
- 移动端

### Infrastructure

- 数据库或派生索引
- REST、GraphQL 或本地 HTTP server
- daemon 或 background service
- 账号、云同步或团队协作

### External Integrations

- GitHub、Linear、Jira 等同步
- VS Code、Raycast 等额外入口
- Agent SDK 或 GUI automation

### Intelligence

- semantic search 或 embedding
- AI tagging、prioritization 或 decomposition
- automatic execution
- 自动识别当前 IDE、terminal 或聊天对应的项目

### Advanced UX

- 跨项目搜索
- 看板分页或虚拟列表
- 外部冲突自动文本合并
- 应用内删除撤销
- 完整无障碍替代操作

## 成功信号

- Repeat Capture：用户是否在多个 session 持续新增 Quest。
- Recall：用户是否重新打开或搜索历史 Quest。
- Agent Recall：Coding Agent 是否能稳定找回相关项目记忆。
- Outcome：Quest 是否会进入 Ready 或 Done，而不是永久堆积。

