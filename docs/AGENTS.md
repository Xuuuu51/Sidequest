# Documentation Guide

适用于 `docs/`。先遵守仓库根 `AGENTS.md`。

## 渐进式阅读

- 从 [README.md](./README.md) 开始，只读取当前任务所需的层。
- 产品判断：`product/`。
- 稳定数据与接口：`contracts/`，并继续读取该目录的 `AGENTS.md`。
- Desktop 用户行为、状态与视觉：`desktop/`。
- 技术结构与 adapter 边界：`architecture/`。
- 实施顺序和可执行验收：`delivery/`。
- 过往提案：`history/`，并继续读取该目录的 `AGENTS.md`。

## 单一所有权

| 内容 | 唯一 owner |
|---|---|
| 领域术语 | `CONTEXT.md` |
| 愿景与产品原则 | `product/vision.md` |
| MVP 包含/不包含 | `product/mvp-scope.md` |
| Quest 数据与文件规则 | `contracts/quest-storage.md` |
| Project/Workspace 路径语义 | `contracts/workspace.md` |
| CLI 与 JSON Public API | `contracts/cli.md` |
| Desktop 用户可见行为 | `desktop/product.md` |
| Main Window 转换 | `desktop/main-window-state.md` |
| 视觉 token 与组件规格 | `desktop/design-system.md` |
| 系统边界与技术栈 | `architecture/overview.md` |
| Rust Core API | `architecture/core.md` |
| Tauri/React 状态边界 | `architecture/desktop.md` |
| CLI/Skill 安装分发 | `architecture/distribution.md` |
| 实施顺序 | `delivery/implementation-plan.md` |
| 可执行验收 | `delivery/acceptance.md` |

## 写作规则

- 文档使用中文；代码标识、命令、状态值和 UI 原文保留英文。
- 一个规则只在 owner 中完整描述；其他文件只说明为什么相关并链接过去。
- 使用相对 Markdown 链接，移动或重命名后同步验证全部链接。
- 当前规范使用“状态”标记；历史材料必须显式声明非规范性。
- 不把未来设想写成已确认需求，不把验收 checklist 混入设计或架构文档。

