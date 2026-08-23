# Tauri Backend Guide

适用于 Desktop Rust backend，并继承上层 `AGENTS.md`。

- Tauri command 只做参数转换、Core 调用、Desktop orchestration 和 DTO/error 映射。
- Quest、Workspace、validation、search 与 storage 行为必须委托给 `sidequest-core`。
- Desktop 必须使用精确项目路径打开 Workspace，不调用 CLI 的向上解析流程。
- 不向 React 暴露 Rust debug chain 或 filesystem implementation detail。
- Native plugin、capability 和 permission 保持最小化，新增时同时验证实际权限范围。
