# Desktop Implementation Guide

适用于 `apps/desktop/`，并继承仓库根 `AGENTS.md`。

- 产品行为读取 `docs/desktop/product.md` 与 `docs/desktop/main-window-state.md`。
- 视觉实现读取 `docs/desktop/design-system.md`。
- 技术边界读取 `docs/architecture/desktop.md`。
- 保留 Tauri 2 官方 scaffold 的构建结构；插件和依赖只在当前需求使用时加入。
- Desktop-only 数据不得成为 Quest 的第二份 Source of Truth。
