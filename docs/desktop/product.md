# Sidequest Desktop MVP 产品设计

> 状态：已确认产品基线  
> 平台：macOS  
> 界面语言：英文、简体中文
> 更新日期：2026-08-24

本文只定义 Desktop 的用户入口、窗口与可见行为。视觉规格见 [Design System](./design-system.md)，精确转换见 [Main Window 状态机](./main-window-state.md)，技术实现见 [Desktop 架构](../architecture/desktop.md)。

## 1. 应用与窗口

MVP 包含 Main Window 与独立的 Quick Capture Window。

- Sidequest 是 macOS 菜单栏应用，不显示 Dock 图标，也不出现在 `⌘Tab` 应用切换器中。普通主动启动显示 Main Window；开机启动只显示菜单栏状态项。
- 关闭 Main Window 只隐藏窗口；菜单栏状态项使用动态的 Show Main Window / Hide Main Window 重新显示或安全隐藏它。显示时恢复原页面状态并激活、聚焦窗口；隐藏时先完成与红色关闭按钮相同的写入保护。
- `⌘Q` 或 Quit 才退出应用，退出后全局快捷键不可用。
- 常驻菜单栏状态项使用实心模板轮廓与透明 `S` 镂空组成的反相图标，并由 macOS Template Image 自动适配菜单栏明暗。菜单提供 Show/Hide Main Window、Quick Capture、Settings… 与 Quit Sidequest；快捷键在菜单右侧的 native accelerator column 中以低强调样式展示，并显示当前 Quick Capture 全局快捷键。左右键打开同一菜单；应用激活时仍保留完整 macOS 应用菜单。
- 开机启动默认关闭，可在 onboarding 和 Settings 中开启。
- 默认 Quick Capture 快捷键为 `⌘⇧Space`；注册冲突不阻止启动，Settings 会显示冲突并允许重新录制。

## 2. Onboarding

首次启动使用与 Main Window 相同的默认及最小窗口尺寸，并在不滚动的单页中展示：

1. 右上角固定展示 Sidequest App Icon 与产品名称。
2. 左栏以 Add Project 为唯一开始条件；成功添加后留在当前页面，并允许进入 Main Window。左栏底部同时展示当前 Quick Capture 全局快捷键与核心工作方式，不模拟 Quick Capture Window，也不在 onboarding 内录制快捷键或修改开机启动。
3. 右栏集中展示 `sq` CLI、Codex Skill 与 Claude Skill 的真实安装状态，并提供与 Settings 相同的 Install / Repair / Uninstall 能力。

页面不使用步骤切换、进度条或逐步 Continue / Skip，不产生纵向滚动。所有工具与集成操作仍可稍后在 Settings 修改。

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

Remove Project 始终先显示二次确认。确认框展示完整路径、有效 Quest 数与损坏文件数，并提供默认不勾选的 `Remove all Quests` 选项；未勾选时只移除本机列表记录，勾选后同时删除 `.sidequest/`，并明确提示不可撤销。无法检查项目数据时禁用该选项，只允许移除本机记录。规则由 [Workspace 契约](../contracts/workspace.md)定义。

移除当前项目后选中最近使用的其他可用项目；没有项目时回到 onboarding。

## 4. Main Window

窗口的尺寸和 panel metrics 由 [Design System](./design-system.md)定义。首次居中，之后记住尺寸和位置；原显示器不存在时回到主显示器并确保标题栏可见。支持 macOS 全屏。

结构为：

```text
Projects Sidebar | Kanban Quest Board | modal Quest Details Drawer
```

Sidebar 支持 resize/collapse，显示项目状态并独立滚动。traffic lights 右侧常驻唯一的 ghost `PanelLeft`：展开时点击收起；收起后不保留窄栏，短暂 hover intent 后或 focus 图标时无背板显示可操作的左侧 modal Sidebar，指针移出图标与 Sidebar 后延迟隐藏，点击图标则以连续动画恢复常驻 Sidebar。Sidebar 顶部在 titlebar 安全区下方显示靠左且上下居中的透明底蓝金品牌标记、Sidequest 名称与紧随标题的版本 Tag。`Projects` 标题右侧是同规格的 icon-only Add Project；Settings 以 gear icon + `Settings` 固定在底部。项目上下文菜单承载 Locate、Reveal 与 Remove。Toolbar 常驻 Search，并提供 `New Quest`；`New Quest` 打开现有 Quick Capture Window 并聚焦输入，不在 Main Window 维护第二套创建表单。

## 5. Kanban Quest Board

主工作区固定显示 Inbox、Ready、Done 三个 `320px` 宽横向状态列；空间不足时看板整体横向滚动。每列独立纵向滚动，列标题显示状态指示、名称与当前可见数量；空列只保留紧凑的 drop target，创建入口仅位于 Toolbar。每列内 Quest 按创建时间从新到旧排列，不提供用户排序。

中文界面将 Inbox、Ready、Done 分别显示为「待整理」「就绪」「已完成」；这只影响界面文案，不改变内部状态值。

Quest Card 将 content 第一行作为视觉标题、其余内容作为弱化摘要，两部分分别最多两行；这不改变 Quest 数据模型。创建时间为次级信息，不重复显示所在状态。整张卡片可打开 Drawer 并拖拽，不显示拖拽手柄；拖到其他状态列或使用 Drawer 状态操作均可改变状态。拖拽只表达 status 变化，不提供列内自由排序。大量数据的虚拟化、分页和完整键盘拖拽不进入 MVP，但必须保留 Drawer 中的按钮式状态操作。

三个空列都使用低强调提示：

```text
No quests
```

## 6. Quest Details Drawer

点击 Quest 行后从右侧打开 modal Drawer；Drawer 覆盖主列表、不压缩列表，显示 backdrop，并在打开期间使背景不可交互。点击 backdrop、关闭按钮或按 `Esc` 请求关闭。Drawer 支持 resize；关闭后保留 Quest selection 并把焦点恢复到对应行。

Drawer Header 提供上一项与下一项，顺序跟随当前搜索过滤后的分组列表与固定组内排序；首尾不循环。关闭、上一项、下一项或其他离开动作都遵守同一套 flush 规则，保存失败时保持 Drawer 打开并阻止切换。

Drawer 不显示 Quest ID 和 Content 标题。正文是首要信息：阅读态安全渲染 GitHub Flavored Markdown，原始 HTML 不执行，链接与图片不触发导航或远程加载；点击阅读区后原位进入原始 Markdown 多行编辑，修改自动保存，不提供 Save/Cancel。编辑器顶部只显示轻量 Markdown 标识和 `⌘S` 提示。创建时间以 `Created …` 放在正文 metadata 行右下角。精确 pending、saving、失败、冲突与离开规则见 [Main Window 状态机](./main-window-state.md)。

底部固定 Action Bar：左侧 Delete，右侧状态 split button。split button 使用其默认流转目标的状态色，替代菜单项以同色状态点辅助识别；文字标签始终保留，不能只靠颜色传达目标状态。

| 当前状态 | 主按钮 | 菜单项 |
|---|---|---|
| Inbox | Move to Ready | Mark Done |
| Ready | Mark Done | Move to Inbox |
| Done | Move to Ready | Move to Inbox |

Delete 必须确认，显示 content 摘要并说明对应文件会被删除且应用内不可撤销。成功后关闭 Drawer，不自动选中下一项。

## 7. Search

Toolbar 常驻紧凑搜索框，只搜索当前项目。非空查询实时过滤当前看板，不切换 presentation；三个状态列、固定排序和拖拽能力继续保留，列标题数量显示当前匹配数。清除查询后恢复未过滤看板和各列原滚动位置。

全部分组均无结果时显示查询词与 Clear Search，不提供“从搜索创建”。损坏文件不参与结果；页面顶部显示可展开警告和匿名文件项，并支持 Reveal in Finder，但不直接展示后端原始路径或错误消息。底层搜索规则见 [Quest 契约](../contracts/quest-storage.md)。

## 8. Quick Capture Window

Quick Capture 是始终置顶的独立 native window。通过全局快捷键唤起时，它直接出现在当前 macOS Space，包括其他应用的原生全屏 Space，并取得输入焦点；不得把用户切回 Sidequest 所在 Space。关闭或保存后把焦点还给原应用。

鼠标进入已显示但未激活的 Quick Capture 时，原生 panel 自动成为 key window 并聚焦 content editor，但不激活整个 Sidequest 应用，使关闭、项目选择和提交操作都能在第一次点击时生效。

中文界面名称为“快速记录”，主操作按钮使用“提交”；Quick Capture 仍是英文产品术语及代码名称。`Quest` 保持不翻译，但上下文明确时可省略并使用量词“条”。

- 点击窗口外部不关闭；`Esc` 或 Close 只隐藏 Quick Capture 并直接丢弃草稿，不显示或激活 Main Window。
- Quick Capture 已显示时再次按全局快捷键，执行与 `Esc` 相同的丢弃草稿并隐藏操作；未显示时仍按正常流程打开。
- `content` 允许多行；`Enter` 换行，`⌘Enter` 保存。
- Project Selector 默认跟随 Main Window 当前项目；用户仍可在 Quick Capture 中临时切换，成功保存后记住该项目，直到 Main Window 再次切换项目。
- Project Selector 位于窗口底部左侧；只读或不可用项目保留当前草稿、允许切换项目，但禁止保存。
- 默认出现在主显示器左下角；用户移动后记住位置，显示器失效时回退到默认位置。
- 提交按钮按 `提交 → progress → ✓ 已提交`（英文对应 `Submit → progress → ✓ Submitted`）显示轻量反馈；成功态保持约 `500ms`，随后隐藏并把焦点还给原应用。
- 保存失败时保留窗口与内容，仅在输入区右下角显示非交互式失败摘要；再次点击保存或按 `⌘Enter` 重试。修改正文或切换项目后清除旧错误。
- 项目不可用或只读时禁止保存且不自动换项目。

没有项目时输入区不可编辑，提示先添加项目并提供 Add Project…。

## 9. Settings

Settings 是 Main Window 内的全屏页面状态，不是独立窗口。从 Projects Sidebar、`⌘,` 或菜单进入后，Settings 自己的 Sidebar 与内容面板替换 Projects Sidebar 和 Quest Board。traffic lights 下方的返回项退出 Settings；`Esc` 不退出。返回后恢复项目、搜索和分组列表滚动位置，但不自动重开 Quest Details Drawer。设置即时保存，无全局 Save/Cancel。

Settings Sidebar 固定显示带图标的 General、Keyboard Shortcuts、Integrations、Tools、About。每次进入默认选择 General，切换后右侧只显示当前分类；切离 General 时取消正在进行的 Quick Capture 快捷键录制。设置操作可以在后台继续，分类切换不被阻止。

Settings 只包含：

- General：Appearance、Language、`Shortcut` 与 Launch at Login。Appearance 使用 `System / Light / Dark` 三段式单选，默认 System；更改成功保存后立即作用于所有窗口与原生窗口外观，不重置当前操作状态。Language 默认为跟随系统，也可固定为 English 或简体中文；更改成功保存后立即作用于两个窗口和原生菜单。点击 Shortcut 后直接录制组合键；必须包含 Command、Control 或 Option，并使用字母、数字、Space、方向键或 F1–F12。前端按物理按键归一化 Option/Shift 产生的字符；无效组合保留录制状态并就地提示，不调用 backend。录制期间无论焦点位于 Settings 的哪个控件，`Esc` 都取消录制但不退出 Settings；注册冲突不替换旧值，可 Restore Default。
- Keyboard Shortcuts：只读展示 Sidequest 当前明确支持的产品级快捷键，并按 Global、Main Window、Quick Capture 与 Settings 分组；当前 Quick Capture 全局快捷键读取已保存值。此分类不提供录制、恢复默认或任何修改入口，也不罗列系统通用的文本编辑、窗口与辅助功能键盘操作。
- Integrations：Codex、Claude 两行，只显示 Ready、Not Installed、Needs Attention 与对应 Install/Repair/Uninstall。
- Tools：`sq` CLI，只显示 Installed、Not Installed、Needs Attention 与对应 Install/Repair/Uninstall。
- About：Desktop version、Licenses 与 Diagnostics。Diagnostics 提供 Copy Diagnostics 和 Reveal Logs；摘要不包含 Quest 内容、搜索内容、用户名或项目绝对路径。

Settings 中无法归属到单个控件的反馈使用右下角 toast；成功反馈约 `3s`，错误反馈约 `8s`，均自动消失且允许手动关闭。重复错误更新既有 toast，不连续堆叠。

不提供 Projects、Quick Capture Position、App Data 或更新入口。路径、版本和 hash 只在异常时按需展示。安装技术规则见 [Integration 与分发](../architecture/distribution.md)。

## 10. 语言与范围

- MVP 只支持 macOS，UI 支持英文和简体中文；英文是完整 fallback，内部产品文档与术语使用中文。
- 默认跟随系统。简体中文系统区域映射到 `zh-CN`；繁体中文及其他尚不支持的系统语言回退英文。手动选择持久化到 app-local state，系统语言变化在下次启动时生效。
- Quest content、CLI/JSON contract、Agent Skill、日志和诊断摘要不做翻译。日期和相对时间使用当前界面的 locale 格式化。
- 界面错误只显示本地化摘要；后端原始 message/path 仅在 Debug build 的 DevTools console 中可见，不写入普通界面或 release console。
- 完整包含与排除项只在 [MVP Scope](../product/mvp-scope.md)维护。
- 代码签名、自动更新与发布权限体验在 release 阶段确认。
