# Desktop Main Window 交互状态机

> 状态：实现基线  
> 日期：2026-08-24
> 视觉基线：[Desktop Application Shell 与 Design System](./design-system.md)  

## 1. 目标与边界

本文定义 Main Window 的 UI 状态、事件、转换、离开保护和异常反馈。它不改变 [Quest Data Contract](../contracts/quest-storage.md)，也不向 Quest 增加字段。

必须区分两类状态：

- Domain status：`inbox | ready | done`，写入 Quest 文件。
- UI state：当前项目、搜索、选择、Drawer、待自动保存内容、拖拽、确认框和提示，只存在于 Desktop 状态或 React 内存中。

不要把所有 UI 状态合并为一个巨大枚举。Main Window 使用多个相互约束的正交状态区。

## 2. 顶层页面状态

```mermaid
stateDiagram-v2
    [*] --> Restoring
    Restoring --> Onboarding: 没有项目
    Restoring --> ProjectLoading: 有上次项目
    Onboarding --> ProjectLoading: Add Project
    ProjectLoading --> ListReady: 加载成功
    ProjectLoading --> ProjectUnavailable: 路径失效
    ProjectLoading --> ProjectFatalError: 无法读取 workspace
    ListReady --> Settings: Open Settings
    Settings --> ListReady: Back
    ListReady --> ProjectLoading: Select Project
    ProjectUnavailable --> ProjectLoading: Locate / Retry
    ProjectUnavailable --> Onboarding: Remove last project
    ProjectFatalError --> ProjectLoading: Retry
```

说明：

- 单个损坏 Quest 文件不是 `ProjectFatalError`，它只产生非阻塞 warning banner。
- Read Only 仍属于 `ListReady`，通过 workspace capability 限制写操作。
- Settings 是 Main Window 内的全屏页面状态，不创建新窗口；进入后替换 Projects Sidebar 与 Quest Board，Back 恢复先前工作区，`Esc` 不退出。
- Settings 每次进入以 General 为初始分类。切换 General / Integrations / Tools / About 只替换右侧内容，并取消正在进行的 Quick Capture 快捷键录制；已经开始的异步设置操作继续执行。

## 3. 正交状态模型

```text
MainWindowUI
├─ route
│  ├─ onboarding
│  ├─ quests
│  └─ settings
├─ workspace
│  ├─ restoring
│  ├─ loading
│  ├─ writable
│  ├─ readOnly
│  ├─ unavailable
│  └─ fatalError
├─ presentation
│  ├─ groupedList
│  └─ filteredGroupedList(query)
├─ selection
│  ├─ none
│  └─ quest(id)
├─ drawer
│  ├─ closed
│  ├─ viewing
│  ├─ editing
│  ├─ autoSavePending
│  ├─ saving
│  ├─ saveError
│  └─ externalConflict
├─ drag
│  ├─ idle
│  └─ dragging(id, fromStatus)
├─ statusMenu
│  ├─ closed
│  └─ open
├─ deletion
│  ├─ idle
│  ├─ confirming
│  ├─ deleting
│  └─ deleteError
└─ feedback
   ├─ none
   ├─ toast
   └─ banner
```

## 4. Main Window 主状态流

```mermaid
stateDiagram-v2
    state ListReady {
        [*] --> GroupedList
        GroupedList --> FilteredGroupedList: query 非空
        FilteredGroupedList --> GroupedList: Clear Search

        GroupedList --> QuestSelected: Select Quest
        FilteredGroupedList --> QuestSelected: Select Quest
        QuestSelected --> GroupedList: Close Drawer / empty query
        QuestSelected --> FilteredGroupedList: Close Drawer / query 非空
        QuestSelected --> QuestSelected: Previous / Next

        GroupedList --> Dragging: Begin Drag
        FilteredGroupedList --> Dragging: Begin Drag
        Dragging --> GroupedList: Cancel / Invalid Drop / empty query
        Dragging --> FilteredGroupedList: Cancel / Invalid Drop / query 非空
        Dragging --> GroupedList: Drop In Group / empty query
        Dragging --> FilteredGroupedList: Drop In Group / query 非空
    }

    ListReady --> ProjectLoading: Select Another Project
    ListReady --> Settings: Open Settings
```

`Close Drawer` 只关闭 Drawer，不清除 `selection.quest(id)`；列表行继续保持 selected 样式并恢复焦点。Drawer 是 modal，打开期间背景列表不可交互；连续浏览通过 Previous / Next 完成。

## 5. Quest Details Drawer 状态机

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Viewing: Open Selected Quest
    Viewing --> Editing: Focus Content
    Editing --> AutoSavePending: Content Changed
    AutoSavePending --> Saving: 500ms Debounce / Flush
    Saving --> Editing: Save Success
    Saving --> SaveError: Save Failure
    SaveError --> Saving: Retry
    SaveError --> Viewing: Discard Local Changes / Reload Disk
    Editing --> Viewing: Blur Without Pending Change
    Viewing --> ConfirmDelete: Delete
    Editing --> ConfirmDelete: Delete
    AutoSavePending --> ConfirmDelete: Delete / Cancel Pending Write
    ConfirmDelete --> Deleting: Confirm
    ConfirmDelete --> Viewing: Cancel
    Deleting --> Closed: Delete Success
    Deleting --> DeleteError: Delete Failure
    DeleteError --> Deleting: Retry
    DeleteError --> Viewing: Cancel
    AutoSavePending --> Saving: Close / Previous / Next / Status / Cmd+S
    AutoSavePending --> ExternalConflict: External Modify/Delete
    ExternalConflict --> Viewing: Load Disk Version
    ExternalConflict --> Saving: Confirm Overwrite
```

### 5.1 Drawer Action Bar

Drawer rest 状态：

```text
左侧：Delete
右侧：Status Split Button
```

规则：

- Content 修改后进入 `autoSavePending`，最后一次输入后 `500ms` 自动保存。
- 待保存与保存期间，Action Bar 保持 Delete + Status Split Button，不显示 Save、Cancel 或离开确认。
- Created metadata 行右侧依次显示 `Saving…` 和短暂的 `Saved`；反馈不得改变布局。
- 实际写入进行期间 split button 保持可见但暂时禁用；pending 阶段点击状态动作会先触发立即 flush。
- `⌘S` 只用于立即 flush 当前 pending 内容，不显示保存确认。
- Close Drawer、Previous / Next、切换项目、进入 Settings、关闭窗口或执行状态修改时，立即 flush pending 内容；成功后自动继续原始动作。
- `saveError` 保留本地内容，在 Action Bar 上方显示 Retry 和 Discard Local Changes；错误未处理前阻止离开。
- Read Only 时正文不可编辑，Delete 与状态按钮禁用；仍允许选择和复制正文。

### 5.2 Modal 与 Previous / Next

- Drawer 显示 backdrop、锁定背景交互并维持 focus trap；点击 backdrop、关闭按钮或在没有更高优先级浮层时按 `Esc` 都进入 `Close Drawer` 流程。
- Previous / Next 以当前 query 过滤后的可见 Quest 顺序为基准：状态组顺序固定为 Inbox、Ready、Done，组内按 Quest 契约的固定顺序排列。
- 到达首项或末项时对应按钮禁用，不循环。
- Previous / Next 前存在 pending 或 saving 时先 flush；失败保持当前 Quest 和 Drawer，不改变 selection。
- Drawer 关闭后焦点回到 selected Quest 行；若该行因 query 或外部更新不再可见，焦点回到分组列表容器。

### 5.3 状态 Split Button

| 当前状态 | 主按钮 | 菜单项 |
|---|---|---|
| Inbox | `Move to Ready` | `Mark Done` |
| Ready | `Mark Done` | `Move to Inbox` |
| Done | `Move to Ready` | `Move to Inbox` |

转换规则：

- `viewing` 或无 pending 内容的 `editing` 状态下点击后立即调用 Core 写入 status。
- 如果存在 `autoSavePending`，先 flush content；只有保存成功才继续写入 status。
- 写入期间禁用 split button，并在按钮内显示小型 progress。
- 成功后 Quest 移动到目标状态组，Drawer 保持打开，selection 保持同一个 ID。
- 失败时 Quest 留在原状态组，Drawer 保持打开，并在 Action Bar 上方显示可重试错误。
- 菜单打开时按 `Esc` 只关闭菜单，不关闭 Drawer。
- Done 没有后续状态，主按钮使用最常用的恢复动作 `Move to Ready`。

## 6. 拖拽状态

| 当前条件 | 行为 |
|---|---|
| Writable + 无 pending/save operation | 允许拖拽 |
| Read Only | 禁止拖拽 |
| 选中 Quest 正在 pending、saving 或 saveError | 禁止拖拽该 Quest |
| Pointer 移动小于激活距离 | 视为 click，不进入 drag |
| Drop 回原状态组 | 不写文件，恢复原位 |
| Drop 到新状态组 | 立即乐观移动并调用 Core 修改 status |
| 写入成功 | 使用落盘后的 DTO，并按目标组排序规则定位 |
| 写入失败 | 回滚原状态组并显示错误 toast |

拖拽视觉：

- Pointer 移动约 `6px` 后才激活拖拽；整行可拖，hover/focus 时显示手柄作为 affordance。
- 原行保留低透明度占位，目标状态组高亮。
- 目标位置显示 `2px` insertion indicator；位置由目标组的固定排序规则计算，不由 pointer 的纵向位置决定。
- Drag overlay 不旋转、不缩放，不使用弹跳动画。
- 搜索过滤期间保持相同分组与拖拽语义。
- 按 `Esc` 取消拖拽。
- Resize 与 native window movement 不进入 Quest drag state。

## 7. 搜索状态

```mermaid
stateDiagram-v2
    [*] --> EmptyQuery
    EmptyQuery --> Searching: 输入首个字符
    Searching --> Results: 有结果
    Searching --> NoResults: 无结果
    Results --> Searching: 修改 query
    NoResults --> Searching: 修改 query
    Results --> EmptyQuery: Clear / Esc
    NoResults --> EmptyQuery: Clear / Esc
```

规则：

- Empty query 显示完整 Kanban board。
- 非空 query 原位过滤三个状态列；列标题数量显示当前匹配数，空列保留紧凑 drop target。
- 搜索是本地 substring match，不显示远程 loading skeleton。
- 清除搜索恢复未过滤看板和三个状态列各自的滚动位置。
- Drawer 打开时背景不可交互；编辑导致当前 Quest 不再匹配 query 时 Drawer 保持打开，关闭后按 focus fallback 规则返回列表。
- Previous / Next 只遍历当前可见结果。
- 损坏 Quest 不进入结果，但 warning banner 仍显示。

## 8. Workspace 与文件异常状态

### 8.1 Loading

- 保留 Application Shell 和 Sidebar，Kanban Quest Board 显示低干扰 progress。
- 不使用成组 skeleton rows。
- 项目切换时旧项目内容立即不可操作，避免误写旧 workspace。

### 8.2 Empty Project

- 保留三个 status lane header 与空列 drop target。
- Inbox 显示产品定义的主要空状态文案和打开 Quick Capture 的 `New Quest` 动作；Ready、Done 使用更弱的单行 empty label。

### 8.3 Read Only

- 主列表顶部显示 persistent compact banner。
- 允许浏览、搜索、选择和复制。
- 禁止编辑、删除、拖拽、状态修改和 Quick Capture 保存。
- 所有禁用操作提供原因 tooltip：`Project is read-only`。

### 8.4 Unavailable

- Sidebar 保留项目行并显示 warning icon。
- 主列表不显示缓存 Quest，改为 unavailable state。
- 提供 `Locate Folder`、`Retry` 和项目菜单中的 `Remove Project`。
- 不自动向上解析或切换到其他目录。

### 8.5 Corrupt Quest Files

- 有效 Quest 正常加载。
- 主列表顶部显示：`N quest files could not be read · View Details`。
- Details 列出文件路径并提供 Reveal in Finder。
- 不自动修复、覆盖或删除损坏文件。

### 8.6 Fatal Workspace Error

- 只用于 `.sidequest/` 整体无法读取等阻塞错误。
- 主列表显示错误原因、`Retry` 和 `Reveal in Finder`。
- Sidebar 与项目管理仍可使用。

## 9. 删除流程

```mermaid
stateDiagram-v2
    Viewing --> Confirming: Delete
    Editing --> Confirming: Delete
    AutoSavePending --> Confirming: Cancel Pending Write / Delete
    Confirming --> Viewing: Cancel
    Confirming --> Deleting: Confirm Delete
    Deleting --> Closed: Success
    Deleting --> DeleteError: Failure
    DeleteError --> Deleting: Retry
    DeleteError --> Viewing: Cancel
```

- 确认框显示最多三行 content 摘要。
- 明确说明对应 Markdown 文件将删除，且 MVP 无应用内撤销。
- 如果仍有短暂 pending 内容，打开确认框前取消 pending write；确认框说明最近输入也会随 Quest 一并删除。
- 删除成功关闭 Drawer、保留其他行位置、不自动选择下一项，并显示 `Quest deleted`。

## 10. 自动保存与离开行为

| 用户动作 | 无 pending 内容 | Auto-save pending / saving | Save error |
|---|---|---|---|
| Close Drawer | 直接关闭 | 立即 flush，成功后关闭 | 阻止离开并显示恢复操作 |
| Previous / Next | 直接切换 | 立即 flush，成功后切换 | 阻止离开并显示恢复操作 |
| Select Project | 直接加载 | 立即 flush，成功后加载 | 阻止离开并显示恢复操作 |
| Open Settings | 直接进入 | 立即 flush，成功后进入 | 阻止离开并显示恢复操作 |
| Close Main Window | 直接隐藏 | 立即 flush，成功后隐藏 | 阻止隐藏并显示恢复操作 |
| Quit App | 直接退出 | 立即 flush，成功后退出 | 显示系统级失败恢复确认 |

正常保存不显示 Save confirmation，也不要求用户再次执行原始动作。

Save error 恢复操作：

```text
Retry
Discard Local Changes
Cancel Current Navigation
```

只有实际写入失败时才允许出现数据丢失确认。

## 11. 事件优先级与不变量

优先级从高到低：

1. 删除确认与系统级确认框。
2. Save error / External conflict。
3. Saving / status writing / deleting。
4. Auto-save pending flush。
5. Dragging。
6. 普通 selection、search 和 navigation。

不变量：

- `drawer != closed` 时必须存在 `selection.quest(id)`。
- `drawer != closed` 时背景列表必须 inert；Drawer 关闭后焦点回到 selected row 或列表 fallback。
- `autoSavePending`、`saving` 或 `saveError` 时不得拖拽同一个 Quest。
- `workspace != writable` 时不得触发任何写操作。
- 同一 Quest 同一时刻只允许一个 write operation。
- status 写入、content 保存和删除都必须通过 Tauri Command 调用 `sidequest-core`。
- 文件 watcher 事件只触发 debounce + reload，不直接推导增量状态。
- UI 不展示 Quest ID，但内部 selection 与命令仍使用 ID。
