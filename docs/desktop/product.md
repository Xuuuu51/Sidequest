# Sidequest Desktop MVP 产品设计

> 状态：已确认产品基线  
> 平台：macOS  
> 界面语言：英文  
> 更新日期：2026-08-23

本文只定义 Desktop 的用户入口、窗口与可见行为。视觉规格见 [Design System](./design-system.md)，精确转换见 [Main Window 状态机](./main-window-state.md)，技术实现见 [Desktop 架构](../architecture/desktop.md)。

## 1. 应用与窗口

MVP 包含 Main Window 与独立的 Quick Capture Window。

- 关闭 Main Window 只隐藏窗口；Dock 图标重新打开它。
- `⌘Q` 或 Quit 才退出应用，退出后全局快捷键不可用。
- 菜单栏提供 Open Sidequest、Quick Capture、禁用的 Settings… 与 Quit Sidequest。
- 开机启动默认关闭，可在 onboarding 和 Settings 中开启。
- 默认 Quick Capture 快捷键为 `⌘⇧Space`；阶段 6 注册冲突不阻止启动、不显示警告，用户仍可从菜单打开。冲突检测与重新设置留到 Settings。

## 2. Onboarding

首次启动按顺序展示：

1. Add Project：必需；选择并成功打开项目后才继续。
2. Quick Capture：可跳过；设置快捷键与是否开机启动。
3. Coding Agents：可跳过；分别安装 Codex 或 Claude Skill。

CLI 在 onboarding 期间默认安装。安装失败不阻止进入 Main Window，但必须显示可恢复提示。移除最后一个项目后回到无项目 onboarding，只要求重新添加项目。

## 3. 项目管理

项目操作只存在于 Main Window 的 Projects Sidebar，不出现在 Settings 或菜单栏。

- Add Project 使用 macOS 原生文件夹选择器。
- 选中目录就是项目根目录；没有 `.sidequest/` 时直接初始化。
- 重复添加同一路径只选中现有记录；嵌套目录可成为独立项目。
- Desktop 记住最后选择项目。
- Unavailable 项目保留在列表，不展示旧缓存；提供 Locate Project… 与 Remove from Sidequest。
- Read Only 项目允许浏览、搜索和复制，禁止创建、编辑、拖拽、删除或 Quick Capture 保存；提供 Retry、Reveal in Finder 与 Remove。
- 项目失败时不静默切换到其他项目。

Remove Project 默认只移除本机列表记录。用户可以选择同时删除 `.sidequest/`，此时确认框展示完整路径、有效 Quest 数与损坏文件数，并再次确认不可撤销。规则由 [Workspace 契约](../contracts/workspace.md)定义。

移除当前项目后选中最近使用的其他可用项目；没有项目时回到 onboarding。

## 4. Main Window

窗口的尺寸和 panel metrics 由 [Design System](./design-system.md)定义。首次居中，之后记住尺寸和位置；原显示器不存在时回到主显示器并确保标题栏可见。支持 macOS 全屏。

结构为：

```text
Projects Sidebar | Quest Board | overlay Quest Details Drawer
```

Sidebar 支持 resize/collapse，显示项目状态并独立滚动。`Projects` 标题右侧是 icon-only Add Project；Settings 以 gear icon + `Settings` 固定在底部。项目上下文菜单承载 Locate、Reveal 与 Remove。

## 5. Quest Board

看板固定为 Inbox、Ready、Done 三列，始终横向并排；每列独立纵向滚动，卡片按创建时间从新到旧排列。

Quest 卡片以 content 摘要为主信息，创建时间为次级信息，不重复显示所在状态。拖拽卡片或 Drawer 操作均可改变状态。大量数据的虚拟化、分页和完整无障碍替代方案不进入 MVP，但必须保留按钮式状态操作。

空项目提示：

```text
No quests yet
Use ⌘⇧Space to capture one.
```

## 6. Quest Details Drawer

点击卡片后从右侧覆盖看板打开 Drawer；不压缩三列、不显示 backdrop、点击外部不关闭。Drawer 支持 resize。关闭后保留卡片 selection，点击另一张卡片切换内容。

Drawer 不显示 Quest ID 和 Content 标题。正文是首要信息；创建时间以 `Created …` 单独展示。正文点击后原位进入多行编辑，修改自动保存，不提供 Save/Cancel。精确 pending、saving、失败、冲突与离开规则见 [Main Window 状态机](./main-window-state.md)。

底部固定 Action Bar：左侧 Delete，右侧状态 split button。

| 当前状态 | 主按钮 | 菜单项 |
|---|---|---|
| Inbox | Move to Ready | Mark Done |
| Ready | Mark Done | Move to Inbox |
| Done | Move to Ready | Move to Inbox |

Delete 必须确认，显示 content 摘要并说明对应文件会被删除且应用内不可撤销。成功后关闭 Drawer，不自动选中下一张卡片。

## 7. Search

Toolbar 常驻紧凑搜索框，只搜索当前项目。空查询显示三列看板；非空查询实时切换为单列结果，展示 content 摘要、创建时间与文字 status。清除查询后恢复各列原滚动位置。

无结果显示查询词与 Clear Search，不提供“从搜索创建”。损坏文件不参与结果；页面顶部显示可展开警告，列出路径并支持 Reveal in Finder。底层搜索规则见 [Quest 契约](../contracts/quest-storage.md)。

## 8. Quick Capture Window

Quick Capture 是始终置顶的独立 native window：

- 点击窗口外部不关闭；`Esc` 或 Close 关闭并直接丢弃草稿。
- `content` 允许多行；`Enter` 换行，`⌘Enter` 保存。
- Project Selector 记住上次成功保存的项目。
- 默认出现在主显示器左下角；用户移动后记住位置，显示器失效时回退到默认位置。
- 保存成功显示 400–600ms 轻量反馈，随后隐藏并把焦点还给原应用。
- 保存失败时保留窗口与内容。
- 项目不可用或只读时禁止保存且不自动换项目。

没有项目时输入区不可编辑，提示先添加项目并提供 Add Project…。

## 9. Settings

Settings 是 Main Window 内的单页状态，不是独立窗口。从 Sidebar、`⌘,` 或菜单进入；返回后恢复项目、搜索和看板滚动位置，但不自动重开 Drawer。设置即时保存，无全局 Save/Cancel。

Settings 只包含：

- General：`Shortcut` 与 Launch at Login。点击 Shortcut 后直接录制组合键；必须包含修饰键，`Esc` 取消，冲突不替换旧值，可 Restore Default。
- Coding Agents：Codex、Claude 两行，只显示 Ready、Not Installed、Needs Attention 与对应 Install/Repair/Uninstall。
- Command Line Tool：只显示 Installed、Not Installed、Needs Attention 与对应 Install/Repair/Uninstall。
- About：Desktop version、Check for Updates、Licenses。

不提供 Projects、Quick Capture Position、App Data 或独立 Diagnostics 设置。路径、版本和 hash 只在异常时按需展示。安装技术规则见 [Integration 与分发](../architecture/distribution.md)。

## 10. 语言与范围

- MVP 只支持 macOS，UI 固定英文；内部产品文档与术语使用中文。
- UI 字符串集中管理，但首版没有语言设置。
- 完整包含与排除项只在 [MVP Scope](../product/mvp-scope.md)维护。
- 代码签名、自动更新与发布权限体验在 release 阶段确认。
