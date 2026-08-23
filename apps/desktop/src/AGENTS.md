# React Frontend Guide

适用于 Desktop React frontend，并继承上层 `AGENTS.md`。

- React 不解析、读取或写入 `.sidequest/` 文件。
- Native 调用集中到类型化 Tauri wrapper，不在 feature component 中散落裸 `invoke()`。
- Tauri-backed data 归 TanStack Query；纯 UI/workflow state 归 Zustand。对应依赖在需要该功能的阶段再加入。
- 不复制 Workspace snapshot 到 Zustand，不在 store 内调用 React Query hooks。
- 组件测试使用 Vitest 与 Testing Library，按用户可观察行为断言。
