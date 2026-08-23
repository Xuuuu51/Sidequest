# MVP 架构总览

> 状态：实现基线  
> 更新日期：2026-08-23

本文只定义系统边界、依赖方向、技术栈与仓库布局。数据协议和接口细节由下游文档各自负责。

## 1. 依赖方向

```text
React
  ↓
Tauri Commands
  ↓
sidequest-core
  ↓
Filesystem

CLI
  ↓
sidequest-core
  ↓
Filesystem

Agent
  ↓
sq CLI
  ↓
sidequest-core
  ↓
Filesystem
```

业务逻辑只放在 Rust `sidequest-core`。React、Tauri command 与 CLI command 都是 adapter，不得重复实现 parsing、validation、workspace resolution、search 或写入逻辑。React 不直接解析或写入 `.sidequest/`。

## 2. 技术栈

- Core：Rust library。
- CLI：Rust + clap，native executable `sq`。
- Desktop：Tauri 2 + React + TypeScript。
- Desktop server data：TanStack Query。
- Desktop UI/workflow state：Zustand。
- Storage：Markdown、YAML frontmatter、filesystem。

产品范围之外的基础设施以 [MVP Scope](../product/mvp-scope.md)为准；架构不得为这些排除项预建抽象或依赖。

## 3. 数据分层

| 数据 | Canonical owner | 持久化位置 |
|---|---|---|
| 项目 Quest | `sidequest-core` | `<project>/.sidequest/` |
| Desktop 项目与设置 | Tauri backend | app-local `app.json` |
| 临时界面状态 | React frontend | 内存 |

各层不得把另一层的数据复制成第二个 Source of Truth。

## 4. 目标仓库布局

```text
Sidequest/
├── Cargo.toml
├── crates/
│   ├── core/
│   └── cli/
├── apps/
│   └── desktop/
├── skills/
│   └── sidequest/
└── docs/
```

Desktop 必须在实施阶段使用 Tauri 2 官方脚手架初始化；在脚手架生成前不预建 `apps/desktop` 占位结构。

## 5. 继续阅读

- Core API 与模块：[Core 架构](./core.md)
- Tauri、React 与多窗口：[Desktop 架构](./desktop.md)
- Quest 文件协议：[Quest 与存储契约](../contracts/quest-storage.md)
- Workspace 解析：[Workspace 契约](../contracts/workspace.md)
- CLI Public API：[CLI 契约](../contracts/cli.md)
