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

App 与项目：`get_app_state`、`add_project`、`remove_project`、`relocate_project`、`set_last_selected_project`、`set_panel_preferences`、`save_main_window_geometry`、`hide_main_window`、`complete_app_quit`。

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

`relocate_project` 只精确打开已有 Workspace，不初始化所选目录。项目与损坏 Quest 文件的 Finder 定位统一使用 Tauri Opener Plugin，React feature 不直接调用 native plugin。

`remove_project` 接收 `deleteSidequestData`。默认只移除 app-local 项目记录；值为 `true` 时必须先由 Core 安全删除 `.sidequest/`，删除失败则保留项目记录。

## 3. App-local state

Tauri backend 将 Desktop-only 数据保存到 app-local `app.json`，例如 macOS 的 Application Support 目录。只允许保存：项目路径、最后选择项目、全局快捷键和窗口/UI 偏好；不得写入 `.sidequest/`。

基础 schema 为：

```json
{
  "schemaVersion": 1,
  "projectPaths": [],
  "lastSelectedProject": null,
  "recentProjectPaths": [],
  "panelPreferences": {
    "sidebarWidth": 224,
    "sidebarCollapsed": false,
    "drawerWidth": 480
  },
  "mainWindow": null
}
```

阶段 4 新增字段使用 Serde default，缺少字段的既有 schema version 1 文件继续有效。`mainWindow` 保存位置、尺寸与 maximized 状态；若原显示器失效或标题栏不可见，启动时回退到主显示器安全区域。

写入必须使用同目录临时文件与 atomic rename。损坏或不支持的 schema 改名保留为 `app.corrupt-<timestamp>[-n].json` 后恢复为空状态，并向当前会话返回 recovery warning；不得静默覆盖损坏文件。

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

Content editor 以最后一次输入后 `500ms` 自动保存。当前 Quest 的 draft、落盘基准、保存/冲突阶段可以作为 workflow state 保存在 Zustand，但不得把 Workspace collection 复制进去。旧写入响应只推进落盘基准，不覆盖更新的本地 draft。

## 5. File watcher

MVP 同时只监听 Main Window 当前项目的 `.sidequest/quests/`。文件事件仅作为 invalidation signal：

```text
filesystem event → debounce → workspace-invalidated → query reload
```

事件 payload 固定为 `{ projectPath }`，React 使用 150ms trailing debounce。同一时刻只保留当前项目 watcher；切换时先停止旧 watcher，新项目不可用时不恢复旧 watcher。

不从事件推导增量数据，不实现 sync engine。refetch 不能直接覆盖未落盘的编辑内容；冲突进入状态机定义的恢复流程。

## 6. Main Window 生命周期

- 红色关闭按钮由 React 拦截：先 flush pending content 与窗口几何，再隐藏而不是销毁 Main Window。
- macOS Dock Reopen 由 native `RunEvent::Reopen` 重新显示并聚焦 Main Window。
- native 退出请求先被阻止并发送 `app-quit-requested`；React 完成 flush 或用户明确放弃本地草稿后调用 `complete_app_quit` 进行一次性退出审批。
- `app-quit-requested` 与其他 native event 一样，只能通过集中式 typed wrapper 订阅。

## 7. 多窗口

Main Window 与 Quick Capture Window 是独立原生窗口，分别拥有 QueryClient 和 Zustand store，不共享 JavaScript memory。Quick Capture 写入后，Main Window 通过 watcher 重新加载。
