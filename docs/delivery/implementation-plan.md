# Sidequest MVP 实现计划

> 状态：已确认实现顺序  
> 更新日期：2026-08-23

实现严格按依赖顺序推进。每一阶段满足完成门槛后再进入下一阶段。

## 0. 工程基线

- 建立根 Cargo 与 pnpm workspace。
- 创建 `crates/core`、`crates/cli`。
- 使用 Tauri 官方 `create-tauri-app` 生成 React + TypeScript Desktop。
- 接入 format、lint、typecheck 和 test 命令。

完成门槛：Rust workspace 测试通过，官方空白 Tauri App 可在 macOS 启动。

## 1. `sidequest-core`

- Domain types、Workspace init/open/resolve。
- Markdown/frontmatter parsing、serialization 与 atomic write。
- Quest CRUD、status、search、sorting。
- 损坏文件隔离和 `delete_sidequest_data` 安全边界。

完成门槛：不依赖 CLI/Desktop，通过测试覆盖完整文件契约、精确路径/向上解析差异和错误隔离。

## 2. `sq` CLI

- 八个 MVP commands。
- Human output、稳定 JSON DTO、JSON Error 与 exit codes。
- stdin、workspace、filter 和 delete confirmation。

完成门槛：Agent 在没有 Desktop 时可以通过 CLI 完成完整 Quest 生命周期；stdout/stderr 契约通过集成测试。

## 3. Desktop 数据基础

- `app.json`、Tauri Commands 和 typed invoke wrapper。
- TanStack Query、Zustand、项目管理与 watcher invalidation。

完成门槛：项目添加、初始化、去重、移除、恢复和外部文件 reload 使用真实 Core 数据工作；React 不直接访问 `.sidequest/`。

## 4. Main Window 读取体验

- Application Shell、Sidebar、Board、Card、Drawer 和 Search。
- Loading、Empty、Read Only、Unavailable、Corrupt Files。

完成门槛：真实 Workspace 可以稳定浏览、选择和搜索；CLI 外部修改能触发刷新。

## 5. Main Window 写入体验

- content auto-save 与 flush orchestration。
- Status Split Button、drag、delete。
- Save Error 与 External Conflict。

完成门槛：同一 Quest 写入串行；旧响应不覆盖新输入；失败不丢失 content；正常流程无保存确认。

## 6. Quick Capture Window

- 独立 always-on-top window、全局快捷键和项目选择。
- 多行输入、`⌘Enter` 保存、失败恢复和位置记忆。

完成门槛：其他应用前台时可以捕获；成功写入 Inbox；失败保留草稿；Main Window 通过 watcher 刷新。

## 7. Settings 与 Integration

- Shortcut 与 Launch at Login。
- managed CLI 默认安装、单独卸载和 repair。
- Codex / Claude Code Skill 管理。

完成门槛：只操作 Sidequest-owned 文件；用户卸载意图得到保留；Integration 失败不阻塞本地 Quest 功能。

## 8. 发布前加固

- 全量错误状态、macOS build、bundle 与新用户环境 smoke test。
- 文档、CLI、Skill 和 Desktop 版本校准。

完成门槛：通过 [MVP Acceptance](./acceptance.md) 中唯一维护的 Release Gate 与人工 smoke test。
