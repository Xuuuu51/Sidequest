# Desktop 技术架构

> 状态：实现基线  
> 更新日期：2026-08-23

本文只定义 Tauri、React、状态管理与多窗口的技术边界。用户行为见 [Desktop 产品设计](../desktop/product.md)与 [Main Window 状态机](../desktop/main-window-state.md)。

## 1. Tauri 边界

Tauri command 只负责参数转换、调用 Core、Desktop orchestration 和 DTO/error 映射。React feature 通过 `apps/desktop/src/shared/tauri/` 的类型化 wrapper 调用，不散落裸 `invoke()`。

Command 名使用 `snake_case`，TypeScript DTO 使用 `camelCase`。统一错误 DTO 为：

```ts
interface CommandErrorDto {
  code: string
  message: string
  path: string | null
}
```

不向 React 暴露 Rust debug chain。

## 2. Commands 与 DTO

App 与项目：`get_app_state`、`add_project`、`remove_project`、`set_last_selected_project`。

Workspace 与 Quest：`load_workspace`、`create_quest`、`update_quest_content`、`set_quest_status`、`delete_quest`、`search_quests`、`set_watched_project`。

Settings 与 integration：`get_settings`、`set_global_shortcut`、`get_integration_status`、`install_cli`、`uninstall_cli`、`install_agent_skill`、`uninstall_agent_skill`。

```ts
interface ProjectDto {
  path: string
  name: string
  state: "writable" | "readOnly" | "unavailable"
}

interface QuestDto {
  id: string
  createdAt: string
  content: string
  status: "inbox" | "ready" | "done"
}

interface WorkspaceSnapshotDto {
  projectPath: string
  access: "writable" | "readOnly"
  quests: QuestDto[]
  issues: { path: string; message: string }[]
}
```

Desktop 始终以精确项目路径调用 Core 的 `open_workspace`。目录选择使用 Tauri 官方 Dialog Plugin。所有写 command 返回落盘后的 DTO；Delete 返回被删除的 ID。

## 3. App-local state

Tauri backend 将 Desktop-only 数据保存到 app-local `app.json`，例如 macOS 的 Application Support 目录。只允许保存：项目路径、最后选择项目、全局快捷键和窗口/UI 偏好；不得写入 `.sidequest/`。

## 4. TanStack Query 与 Zustand

固定边界：

```text
Tauri command-backed data → TanStack Query
纯 UI / workflow state    → Zustand
```

Query 管理 app state、workspace snapshot、搜索结果、设置、integration status 与 mutations。推荐 keys：

```ts
["app-state"]
["workspace", projectPath]
["search", projectPath, query]
["settings"]
["integrations"]
```

Filesystem 数据禁用网络型默认重试、focus/reconnect refresh 和 cache persistence；只在首次加载、显式 Retry、成功 mutation 或 watcher invalidation 时刷新。

Zustand 管理 route、当前项目、搜索 presentation、选中 Quest/Drawer、滚动位置、编辑 workflow、drag/menu/dialog/toast/banner。不得持久化，也不得复制 Quest collection。组件使用细粒度 selector。

同一 Quest 的 mutation 使用相同 scope 串行执行。状态变更不做提前 optimistic update；成功后以 command 返回值更新 cache。自动保存与离开规则由 [Main Window 状态机](../desktop/main-window-state.md)定义，store 内不得调用 React Query hooks。

## 5. File watcher

MVP 同时只监听 Main Window 当前项目的 `.sidequest/quests/`。文件事件仅作为 invalidation signal：

```text
filesystem event → debounce → workspace-invalidated → query reload
```

不从事件推导增量数据，不实现 sync engine。refetch 不能直接覆盖未落盘的编辑内容；冲突进入状态机定义的恢复流程。

## 6. 多窗口

Main Window 与 Quick Capture Window 是独立原生窗口，分别拥有 QueryClient 和 Zustand store，不共享 JavaScript memory。Quick Capture 写入后，Main Window 通过 watcher 重新加载。

