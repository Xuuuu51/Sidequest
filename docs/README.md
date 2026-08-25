# Sidequest 文档导航

> 状态：当前文档入口  
> 更新日期：2026-08-23

文档按“入口 → 领域层 → 任务层 → 稳定契约”渐进读取。不要默认加载整个 `docs/`。

## 最小阅读路径

| 任务 | 依次阅读 |
|---|---|
| 理解产品 | [`CONTEXT.md`](./CONTEXT.md) → [`product/vision.md`](./product/vision.md) → [`product/mvp-scope.md`](./product/mvp-scope.md) |
| 改 Quest/Core | [`contracts/AGENTS.md`](./contracts/AGENTS.md) → [`contracts/quest-storage.md`](./contracts/quest-storage.md) → [`architecture/core.md`](./architecture/core.md) |
| 改 Workspace | [`contracts/AGENTS.md`](./contracts/AGENTS.md) → [`contracts/workspace.md`](./contracts/workspace.md) → [`architecture/core.md`](./architecture/core.md) |
| 改 CLI | [`contracts/AGENTS.md`](./contracts/AGENTS.md) → [`contracts/cli.md`](./contracts/cli.md) → [`architecture/core.md`](./architecture/core.md) |
| 改 Desktop 行为 | [`desktop/product.md`](./desktop/product.md) → [`desktop/main-window-state.md`](./desktop/main-window-state.md) |
| 改 Desktop UI | [`desktop/design-system.md`](./desktop/design-system.md)；若涉及行为，再读上一路径 |
| 改 Tauri/React 数据流 | [`architecture/overview.md`](./architecture/overview.md) → [`architecture/desktop.md`](./architecture/desktop.md) |
| 改 CLI/Skill 安装 | [`architecture/distribution.md`](./architecture/distribution.md) → [`contracts/cli.md`](./contracts/cli.md) |
| 发布社区 macOS 安装包 | [`delivery/community-release.md`](./delivery/community-release.md) → [`delivery/acceptance.md`](./delivery/acceptance.md) |
| 实施与验收 | [`delivery/implementation-plan.md`](./delivery/implementation-plan.md) → [`delivery/acceptance.md`](./delivery/acceptance.md) |

## 分层目录

```text
docs/
├── CONTEXT.md                 领域词汇表
├── product/                   为什么做、MVP 做什么
├── contracts/                 稳定数据与公共接口
├── desktop/                   用户行为、状态机、视觉系统
├── architecture/              技术边界与 adapter 设计
├── delivery/                  实施顺序与验收
├── history/                   非规范性历史材料
└── assets/                    文档引用的视觉资源
```

每个规范只有一个 owner，完整映射和写作规则见当前目录的 [`AGENTS.md`](./AGENTS.md)。遇到冲突时，稳定 contract 优先于实现说明；当前 canonical 文档优先于 history。
