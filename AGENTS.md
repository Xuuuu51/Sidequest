# Sidequest Agent Guide

本文件适用于整个仓库。进入子目录后，继续读取距离目标文件最近的 `AGENTS.md`；下层指令在其范围内补充本文件。

## 开始前

1. 从 [docs/README.md](docs/README.md) 按任务类型选择最小阅读路径。
2. 涉及领域词汇时读取 [docs/CONTEXT.md](docs/CONTEXT.md)。
3. 修改稳定数据、路径或 CLI 行为前，必须读取 `docs/contracts/AGENTS.md` 与对应 contract。
4. 历史文档只用于追溯，不得作为当前实现依据。

## 全局架构边界

系统依赖方向与技术栈以 [架构总览](docs/architecture/overview.md)为唯一来源。必须保持业务逻辑在 Rust Core；React、Tauri command、CLI command 不重复 domain logic，React 不直接访问 Quest 文件。

Quest、Workspace 与 CLI 的稳定接口分别由以下文件独占定义：

- [Quest 与存储契约](docs/contracts/quest-storage.md)
- [Workspace 契约](docs/contracts/workspace.md)
- [`sq` CLI 契约](docs/contracts/cli.md)

不得在代码或其他文档中静默扩展这些契约。兼容性边界变化必须先明确影响，再更新 canonical contract、实现和测试。

## 实现原则

- 选择小模块、显式数据结构、确定性行为、直接 filesystem 操作和最少依赖。
- 不为未来可能性预建数据库、服务层、DI framework、plugin system、HTTP service、daemon 或复杂 trait 层。
- Desktop 必须由 Tauri 2 官方脚手架初始化；脚手架生成前不手工创建占位应用。
- 单个损坏用户文件不得使整个 Workspace 无法使用，也不得被静默修复或覆盖。
- Sidequest 不自动执行 Git add、commit 或 push。

## 变更纪律

- 只修改当前任务所需内容，保留用户的其他 worktree 变更。
- 文档中的规范只允许一个 canonical owner；其他文档用链接引用，不复制规则。
- 新增目录时，如其维护上下文与父级明显不同，再添加局部 `AGENTS.md`，不要提前创建空层级。
- 完成实现后执行与风险相称的 format、lint、typecheck 和 test；交付门槛见 [验收清单](docs/delivery/acceptance.md)。

