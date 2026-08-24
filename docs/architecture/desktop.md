# Desktop 技术架构

> 状态：实现基线  
> 更新日期：2026-08-24

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

Quick Capture：`show_quick_capture`、`hide_quick_capture`、`save_quick_capture_position`、`capture_quest`。`capture_quest` 只接受已注册项目的精确路径；Quest 创建成功后才更新捕获项目偏好。偏好写入失败通过 `preferenceWarning` 返回，不把已经创建的 Quest 伪装成失败。

Workspace 与 Quest：`load_workspace`、`create_quest`、`update_quest_content`、`set_quest_status`、`delete_quest`、`search_quests`、`set_watched_project`。

Settings 与 integration：`get_settings`、`set_global_shortcut`、`set_launch_at_login`、`set_onboarding_step`、`get_integration_status`、`install_cli`、`uninstall_cli`、`install_agent_skill`、`uninstall_agent_skill`。

Locale：`get_locale_settings`、`set_locale_preference`。偏好只接受 `system | en | zh-CN`，由 backend 解析有效 locale、持久化并重建原生菜单；成功后通过 `locale-changed` 同步所有窗口。

Diagnostics：`get_diagnostic_report`、`reveal_diagnostic_logs`。摘要只返回版本、build mode、macOS、CPU 架构、App State schema、项目状态计数、快捷键和 Integration 状态，不返回用户名、绝对项目路径、Quest 数据或日志正文。剪贴板写权限只授予 Main Window。

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
  "mainWindow": null,
  "quickCapture": {
    "lastProjectPath": null,
    "position": null
  },
  "onboardingStep": "addProject",
  "languagePreference": "system",
  "shortcut": {
    "modifiers": ["command", "shift"],
    "key": "Space"
  },
  "integrations": {
    "cliUserUninstalled": false,
    "cli": null,
    "codex": null,
    "claude": null
  }
}
```

新增字段使用 Serde default，缺少字段的既有 schema version 1 文件继续有效。`mainWindow` 保存位置、尺寸与 maximized 状态；`quickCapture.position` 只保存 x/y。若原显示器失效或标题拖动区不可见，窗口回退到主显示器安全区域。

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
["locale-settings"]
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

Desktop command 创建 Quest 后也发出同名 `workspace-invalidated`，因此非当前项目的 Query cache 也会失效。项目列表变化通过 `app-state-invalidated` 同步到两个窗口。

Settings 与 integration 分别通过 `settings-invalidated` 和 `integrations-invalidated` 失效。macOS 菜单通过 `open-settings` 请求 Main Window 先执行既有写入保护，再切换 route。

## 6. 本地化

React 使用编译时打包的 `i18next` / `react-i18next` JSON resources，不使用浏览器语言探测、HTTP backend 或运行时网络。应用在 React mount 前调用 native locale command，避免 fallback 文案闪烁；两个独立窗口通过 `locale-changed` 只切换资源，不重建 QueryClient、Zustand store 或窗口。

资源按 `common`、`main-window`、`quick-capture`、`settings`、`onboarding`、`errors`、`native` namespace 分层，英文为 canonical fallback，测试强制校验简体中文 key 与插值占位符完全一致。新 JSX 可见文字由 ESLint 禁止直接写 literal。

日期使用 `Intl.DateTimeFormat` 与 `Intl.RelativeTimeFormat`。UI error code 映射到本地化摘要；原始 native message/path 只允许 Debug DevTools console，持久日志继续只记录 command、耗时和错误码。

## 7. Main Window 生命周期

- 红色关闭按钮由 React 拦截：先 flush pending content 与窗口几何，再隐藏而不是销毁 Main Window。
- macOS Dock Reopen 由 native `RunEvent::Reopen` 重新显示并聚焦 Main Window。
- native 退出请求先被阻止并发送 `app-quit-requested`；React 完成 flush 或用户明确放弃本地草稿后调用 `complete_app_quit` 进行一次性退出审批。
- `app-quit-requested` 与其他 native event 一样，只能通过集中式 typed wrapper 订阅。

## 8. 多窗口

Main Window 与 Quick Capture Window 是独立原生窗口，分别拥有 QueryClient 和 Zustand store，不共享 JavaScript memory。Quick Capture Window 固定 `520×300`、不可 resize、无原生标题栏并始终置顶；`quick-capture-shown` 只负责刷新项目状态与恢复输入焦点。重复显示现有窗口，不重建 webview，因此草稿和项目选择得以保留。

## 9. 诊断与错误边界

Tauri Logging Plugin 是 Desktop 唯一持久日志入口。Debug build 记录 Debug 及以上，普通构建记录 Info 及以上；文件写入 macOS 标准 Logs 目录，单文件上限 1 MiB，仅保留当前文件和一个轮转文件。隔离 Profile 改写到自己的 `logs/`。

日志只记录生命周期、command 名称与耗时/错误码、watcher、快捷键、菜单和 Integration 结果。React 不把 command 参数或 error message 写入日志；native formatter 将 Home 前缀统一替换为 `~`。禁止记录 Quest content、搜索词和剪贴板内容。

Main Window 与 Quick Capture 各自拥有顶层 Error Boundary，并集中捕获 render error、window error 与 unhandled rejection。Fatal fallback 不自动 reload；内存中存在草稿时必须先明确警告并提供复制途径。

Debug 菜单仅在 `debug_assertions` 下构建。Reload Main Window 必须经过既有写入协调器；Quick Capture 存在草稿时禁止 reload。Release build 不编译 Debug 菜单。

## 10. 隔离 Profile

`pnpm desktop:isolated` 只在 debug build 通过 `SIDEQUEST_DEBUG_PROFILE_DIR` 启用仓库内 `target/desktop-debug-profile/`。该目录分别承载 `app-data/`、`logs/` 和模拟 `home/`；CLI、Codex Skill 与 Claude Skill 由模拟 Home 派生。Release build 忽略 override。

隔离 Profile 禁止修改 Launch at Login，但全局快捷键继续使用真实系统注册。`pnpm desktop:isolated:reset` 必须校验精确目标、拒绝 target/profile symlink，且不得触碰真实 Application Support 或 Home。
