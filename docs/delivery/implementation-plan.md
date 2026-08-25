# Sidequest MVP 实现计划

> 状态：已确认实现顺序  
> 更新日期：2026-08-24

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
- TanStack Query、单一 Main Window Zustand slice store、独立 Quick Capture store、项目管理与 watcher invalidation；简单视图不引入 Router。
- `system | light | dark` theme preference、首帧 theme 初始化和跨窗口 `theme-changed`。

完成门槛：项目添加、初始化、去重、移除、恢复和外部文件 reload 使用真实 Core 数据工作；React 不直接访问 `.sidequest/`。

## 4. Desktop UI 基础

- Tailwind CSS 4、shadcn/ui Base UI base、`components.json` 与 `globals.css`。
- Light/Dark semantic token、Quest status token、系统字体、Lucide 和 Sonner。
- 按实际页面需要建立 `shared/ui` primitives，不预装全部组件或 dashboard blocks。
- 功能组件样式全部使用 Tailwind class/CVA；全局只保留 token、base 与平台例外，不保留旧 CSS 或第二套图标。

完成门槛：Button、Input、Textarea、Switch、Sheet、Alert Dialog、Dropdown Menu、Tooltip 与 toast 在 Light/Dark 下符合 Design System；Base UI 只由 `shared/ui` 直接依赖，现有页面仍可运行和测试。

## 5. Main Window

- 重写 Application Shell 与 Sidebar，并新增打开 Quick Capture 的 `New Quest`。
- 单一滚动容器中的 Inbox、Ready、Done Status Group 与固定高度 Quest Row。
- 原位过滤的 Search、Loading、Empty、Read Only、Unavailable、Corrupt Files。
- shadcn Sheet / Base UI Dialog 驱动的 resizable modal Drawer 与 Previous / Next。
- content auto-save 与 flush orchestration。
- Status Split Button、dnd-kit 跨组 drag、Sonner rollback toast、delete。
- Save Error 与 External Conflict。

完成门槛：真实 Workspace 可以稳定浏览、选择、搜索和跨组移动；同一 Quest 写入串行；旧响应不覆盖新输入；modal 离开保护、focus restoration 与失败回滚不丢失 content。

## 6. Quick Capture Window

- 使用同一 token、shared primitives、Lucide 和 ThemeProvider 重写现有界面。
- 保持独立 always-on-top window、全局快捷键和项目选择。
- 多行输入、`⌘Enter` 保存、失败恢复和位置记忆。

完成门槛：其他应用前台时可以捕获；成功写入 Inbox；失败保留草稿；Main Window 通过 watcher 刷新；主题切换不丢失 Quick Capture draft。

## 7. Onboarding

- 使用同一 token、shared primitives、品牌 App Icon 与 Lucide 构建无需滚动的单页界面。
- Add Project 作为唯一完成条件；左栏展示 Quick Capture 快捷键提示，右栏复用真实 Integration 状态与安装操作。

完成门槛：首次启动和移除最后项目后的两条 onboarding 路径可完成；错误恢复、键盘操作和 Light/Dark 均通过验收。

## 8. Settings、Integration 与稳定性

- 使用连续 settings panel 重写页面，Appearance 使用 System / Light / Dark 三段式 Radio Group。
- Shortcut 与 Launch at Login。
- managed CLI 默认安装、单独卸载和 repair。
- Codex / Claude Code Skill 管理。
- 冻结产品功能与视觉，补齐本机轮转日志、隐私过滤、诊断摘要和 React Error Boundary。
- Debug build 提供 DevTools、受保护 reload、日志入口和仓库内隔离 Profile。
- 审计窗口生命周期、Watcher、Quick Capture、拖拽和 Integration 的异步失败路径。
- 增加英文与简体中文 Desktop resources、系统/手动语言选择、原生菜单同步及本地化回归门禁。

完成门槛：只操作 Sidequest-owned 文件；用户卸载意图得到保留；Integration 失败不阻塞本地 Quest 功能；完整工程门禁和人工视觉矩阵通过；隔离 Profile smoke test 无阻断使用或可能造成数据丢失的问题。

## 9. macOS 发布与更新

- 社区预发布阶段通过 GitHub Releases 分别提供 Apple Silicon 与 Intel DMG，使用 ad-hoc code signing，明确标注未经过 Apple 公证，并保持 Draft + Prerelease 审核流程；具体操作由 [Community Release](./community-release.md)定义。
- 通过 GitHub Releases 发布 Universal Apple Silicon + Intel 单包，最低支持 macOS 13。
- 配置 Developer ID 签名、公证、DMG 与 Tauri Updater。
- 建立发布 workflow、更新 endpoint、产物校验和干净用户环境发布验收。

完成门槛：通过 [MVP Acceptance](./acceptance.md) 中唯一维护的 Release Gate 与发布 smoke test。实现遵循 Tauri 官方 [GitHub 发布流程](https://v2.tauri.app/distribute/pipelines/github/)及 [macOS 签名与公证流程](https://v2.tauri.app/distribute/sign/macos/)。
