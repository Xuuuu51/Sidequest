# Desktop Application Shell 与 Design System

> 状态：已确认设计基线  
> 确认日期：2026-08-24
> 平台：macOS Desktop MVP  
> 设计密度：8/10 · 设计变化度：7/10 · 动效强度：2/10

## 1. 目标

Sidequest Desktop 采用克制、专业、轻量卡片化的桌面生产力工具视觉语言。浅色模式以冷灰白工作区、白色任务表面和细边框为基线；深色模式使用石墨色表面保持相同层级。

本基线参考 Codex Desktop、Linear、Cursor 和 VS Code 的信息组织方式，但只借鉴视觉语言与桌面端交互原则，不引入聊天、代码编辑器、Agent 面板等 Sidequest 产品范围之外的功能。

核心原则：

- 连续工作区优先；Quest 是唯一常驻卡片化的信息对象，避免容器套容器。
- sidebar、toolbar、panel、divider 构成主要层级。
- 小字号、紧凑间距和明确状态服务于高频操作。
- Light / Dark 使用同一套语义层级，分别针对浅色阴影和深色边界调优。
- 键盘与鼠标操作同等重要；焦点状态不可省略。
- 不使用 AI 紫色渐变、玻璃拟态、大圆角、KPI 卡片、三等宽卡片网格和花哨动画。
- Taste 类规则只采用 typography、spacing、visual consistency 与 anti-slop 原则，不采用 landing page 结构。

## 2. Application Shell

### 2.1 总体结构

```text
┌──────────────────────────────────────────────────────────────────┐
│ Titlebar：窗口控制 / 当前项目 / Search / New Quest              │ 44
├──────────────┬───────────────────────────────────────────────────┤
│ Project      │ Inbox        Ready        Done                    │
│ Sidebar      │ Quest cards  Quest cards  Quest cards             │
│              │              Kanban Quest Board                   │
│              │                                                   │
│ Settings     │                              modal Quest Drawer → │
└──────────────┴───────────────────────────────────────────────────┘
```

- 默认窗口：`1280 × 800`。
- 最小窗口：`1024 × 640`。
- Titlebar 高度：`48px`；macOS traffic lights 使用 native logical inset 与右侧 titlebar 图标垂直居中，配置变化需重启原生窗口进程。
- Sidebar 与主列表之间使用 `1px` divider；可拖动分隔条的实际命中区为 `5px`。
- 主界面主要依靠背景层级和分隔线；Quest Card 使用常驻柔和阴影，modal、menu、tooltip 与 drag overlay 使用更强的 overlay 阴影。

### 2.2 Project Sidebar

- 默认宽度 `224px`，最小 `180px`，最大 `320px`。
- Sidebar 是从窗口顶部贯穿到底部的完整表面，右侧 `1px` divider 连续延伸至窗口顶边。
- Sidebar 内不显示 Titlebar 底部分隔线；主工作区的 Titlebar 分隔线从 Sidebar 右侧 divider 开始。
- 支持拖动调整宽度，宽度写入 Desktop app-local JSON。
- 收起后 Sidebar 完全退出布局，不保留 icon rail；恢复后使用上次宽度。
- `PanelLeft` 图标常驻在 macOS traffic lights 右侧，展开与收起时保持完全相同的位置。展开时点击收起；收起时 hover/focus 以无背板的左侧 modal 预览完整 Sidebar，指针离开图标与 Sidebar 的联合区域后关闭，点击恢复常驻 Sidebar。
- Sidebar 内不重复显示右对齐的 `PanelLeft`；整个 Main Window 只有一个 sidebar toggle。
- 左侧 modal 与窗口上、下、左边缘保留 `8px` 间距，使用完整圆角与 overlay 阴影，不显示遮罩，也不将主工作区设为 inert。
- hover modal 保持项目行可点击；从图标移入 modal 不关闭，只有指针离开两者才关闭。hover 打开不得自动移动焦点，避免 pointer 与 focus 状态互相触发。
- hover intent 使用 `120ms` 出现延迟与 `180ms` 消失延迟；重新进入图标或 Sidebar 会取消对应计时，短暂掠过不触发预览，跨越边界也不会闪烁。键盘 focus 仍立即显示。
- 展开、收起与 hover 预览入口始终使用同一个 `PanelLeft` 图标。
- `PanelLeft` 使用与 Add Project 相同的 ghost icon-button 外观、`28px` 命中区和 focus ring，不增加独立描边、常驻底色或阴影。
- 常驻 Sidebar 展开/收起使用 `--motion-panel` 的宽度与透明度过渡，使主工作区连续跟随；hover modal 使用同一时长的轻微横向位移与透明度过渡。`prefers-reduced-motion` 下禁用位移和布局过渡。
- `Projects` 是纯文字 section heading，不带文件夹图标；右侧保留添加项目图标。
- 项目行高 `30px`，图标 `15px`，文字 `13px`。
- 当前项目使用白色/石墨 surface、柔和阴影和 `2px` 品牌色左侧标记；不使用大型圆角胶囊。
- `Settings` 固定在底部并保留文字，其上方 divider 左右贴齐 Sidebar 边缘。

### 2.3 Titlebar 与 Toolbar

- 当前项目名称位于 Sidebar divider 右侧的主工作区 Titlebar。
- Sidebar 收起时，项目名称为 macOS traffic lights 与展开热区保留左侧安全间距。
- Main Window 整条 `48px` titlebar 的非交互区域都是 Tauri native drag region；按钮、搜索框等控件必须位于可交互层并保持正常点击。
- Search 是可直接输入的紧凑搜索框，rest 状态使用填充 muted surface 和弱边界，focus 才显示中性 ring。
- Toolbar 右侧提供 `New Quest`，打开 Quick Capture Window；Quest 删除等上下文动作不进入全局 toolbar。
- 图标默认 `14–16px`，命中区域 `28px`。
- 图标按钮使用 tooltip，并具备清晰 hover、pressed、focus 状态。

### 2.4 Kanban Quest Board

- 主工作区是连续的冷灰看板表面，与更深的 Sidebar 形成克制但明确的层级差异。
- Inbox、Ready、Done 横向组成三个等宽状态列，每列独立纵向滚动，不折叠。
- Status Lane Header 高度 `40px`，包含状态色点、名称与当前可见数量；不放置排序或创建菜单。
- 空列保留紧凑的 drop area；drag over 时通过边框与背景变化扩大视觉反馈，不改变其他列的几何位置。
- Quest Card 高度约 `104–132px`，content 最多四行；创建时间位于底部 metadata 行并右对齐。状态由所属列表达，不在卡片内重复。
- Quest Card 使用白色/石墨 surface、`10px` 圆角、细冷灰边框与常驻柔和阴影。hover 只增强边框和阴影，不平移、不缩放。
- 选中 Quest 使用极浅 `brand-subtle` 背景和 `2px` 品牌色左侧标记；focus 使用独立高对比中性 ring，两种状态可同时表达。
- 状态颜色只用于列标题色点、drag target 等小面积识别，不铺满状态列或 Quest Card。
- 组内排序继续遵守已确认的创建时间规则；insertion indicator 必须显示系统计算出的最终位置，不能暗示自由排序。

### 2.5 Quest Details Drawer

- Quest 详情采用从右侧打开的 modal drawer，覆盖主列表，不压缩主列表宽度。
- Drawer 显示 backdrop、锁定背景交互并维持 focus trap；关闭后把焦点还给 selected Quest Card。
- 默认宽度 `480px`，最小 `420px`，最大 `560px`。
- 支持从左边缘拖动调整宽度；宽度写入 Desktop app-local JSON。
- Drawer 左上、左下圆角为 `12px`，通过清晰左边界和克制阴影表达覆盖关系。
- Header 高度 `44px`，标题为 `Quest details`，提供 Previous、Next 与关闭动作。
- Header 下方 divider 横向贴齐 Drawer 两侧边缘，不使用 inset。
- Drawer 不分配 ID 展示行。
- Content 紧接 Header，是 Drawer 的主要信息；不显示 `Content` label。
- 多行 editor 在 rest 状态直接融入 Drawer 表面，不显示独立背景、边框或圆角容器；仅在 focus 状态显示必要的 focus indicator。
- 创建时间作为 editor 下方的单行 muted metadata，例如 `Created May 12, 2025 at 9:41 AM`。
- Drawer 底部固定 `64px` Action Bar，顶部 divider 横向贴齐 Drawer 两侧。
- Action Bar 左侧是 `Delete` destructive ghost action；点击后仍进入已确认的删除确认流程。
- Action Bar 右侧是状态 split button：主按钮执行高频状态流转，独立 chevron 打开其他状态菜单。
- 自动保存时 Action Bar 始终保持 Delete 与状态 split button；保存节奏由状态机定义。
- Created metadata 行右侧使用低干扰 `Saving…` / `Saved` 表达自动保存状态，不显示 Save confirmation。
- 点击 backdrop、关闭图标或按 `Esc` 请求关闭 drawer，不取消列表中的 Quest selection。

状态 split button 的动作映射见 [Desktop 产品设计](./product.md)。

Done 没有后续状态，因此主按钮采用最常见的恢复动作 `Move to Ready`，菜单保留完全重置到 Inbox 的入口。

## 3. Design Token 架构

组件不得直接使用原始 hex、Tailwind palette utility 或按主题分支的颜色 literal。通用 UI 以 shadcn 语义 token 为 canonical，Quest 状态使用少量 Sidequest 领域扩展：

```text
Theme value → Semantic token → Component usage
#F7F7F8       workspace        main workspace
#C6944B       brand            sparse brand / active marker
#3978D4       status-ready     Ready indicator
```

### 3.1 Semantic Color

| Token | Dark | Light | 用途 |
|---|---:|---:|---|
| `background` | `#151517` | `#F7F7F8` | native app canvas |
| `foreground` | `#F1F1F3` | `#1D1D21` | primary text / Inbox indicator |
| `sidebar` | `#111113` | `#F7F7F9` | sidebar surface |
| `workspace` | `#18181B` | `#FCFCFD` | toolbar / Kanban surface |
| `surface` | `#202024` | `#FFFFFF` | Quest Card / resting control |
| `surface-foreground` | `#F1F1F3` | `#1D1D21` | surface text |
| `elevated` | `#25252A` | `#FFFFFF` | drawer / dialog / popover |
| `elevated-foreground` | `#F4F4F5` | `#1D1D21` | elevated text |
| `primary` | `#F1F1F3` | `#1D1D21` | high-emphasis control |
| `primary-foreground` | `#18181B` | `#FFFFFF` | high-emphasis control text |
| `secondary` | `#29292E` | `#F1F1F3` | secondary control |
| `secondary-foreground` | `#F1F1F3` | `#1D1D21` | secondary control text |
| `muted` | `#29292E` | `#F2F2F4` | subdued / search surface |
| `muted-foreground` | `#A8A8B0` | `#696970` | metadata text |
| `accent` | `#303036` | `#EEEEF1` | neutral hover surface |
| `accent-foreground` | `#F4F4F5` | `#1D1D21` | neutral hover text |
| `brand` | `#C6944B` | `#C6944B` | sparse brand / active marker |
| `brand-foreground` | `#E5BD7B` | `#87591F` | brand icon / text |
| `brand-subtle` | `#302719` | `#FBF5E9` | selected Quest tint |
| `destructive` | `#DF6A6A` | `#C94F4F` | delete / error |
| `destructive-foreground` | `#FFFFFF` | `#FFFFFF` | destructive text |
| `warning` | `#E78938` | `#D97727` | warning independent from brand |
| `border` | `#35353B` | `#E6E6E9` | default divider / border |
| `input` | `#3D3D45` | `#D8D8DD` | input border |
| `ring` | `#D4D4D8` | `#3F3F46` | neutral focus-visible ring |
| `status-inbox` | `foreground` | `foreground` | Inbox indicator |
| `status-ready` | `#6B9DE8` | `#3978D4` | Ready indicator |
| `status-done` | `#5DB57A` | `#32925D` | Done indicator |

`brand`、`warning`、Quest status 和 `ring` 相互独立。Selected Quest 使用 `brand-subtle` 与 `brand` 左侧标记；focused 使用独立 `2px` 中性 ring，二者必须可同时出现。品牌色只在当前项目、selected Quest 与少量品牌图标中出现。

### 3.2 Component Mapping

```text
questRow.background        → surface
questRow.backgroundHover   → surface
questRow.backgroundSelected → brand-subtle
questRow.border            → border
questRow.selectionMarker   → brand / 2px left
questRow.focusRing         → ring
questRow.radius            → radius.10
questRow.minHeight         → size.72
questRow.maxHeight         → size.96
questRow.shadow            → shadow.card
questRow.shadowHover       → shadow.cardHover
questRow.contentColor      → foreground
questRow.metadataColor     → muted-foreground

questDrawer.background     → elevated
questDrawer.border         → border
questDrawer.radiusLeft     → radius.12
questDrawer.widthDefault   → size.480
questDrawer.shadow         → shadow.drawer
questDrawer.actionBarHeight → size.64
questDrawer.actionBarBg    → card
questDrawer.actionBarBorder → border
statusSplitButton.height   → size.32
questContent.background    → transparent
questContent.border        → none
questContent.focusRing     → ring
questContent.autoSaveDelay → motion.autoSaveDelay
questContent.saveStatus    → muted-foreground
```

Light 模式通过柔和投影表达 Quest Card 的边界，Dark 模式以 surface 与 border 为主、投影为辅。`shadow.overlay` 用于 modal drawer、dialog、menu、tooltip 与 drag overlay。

## 4. Typography

- UI 字体：`PingFang SC`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif；英文和数字同样使用该字体链。
- 等宽字体：`SF Mono`, `ui-monospace`, monospace；仅用于 CLI 命令和明确的机器文本。
- 不使用巨型标题；Application Shell 内最大常规标题为 `18px`。

| Role | Size / Line height | Weight |
|---|---|---:|
| Caption | `11 / 16` | 400 |
| Metadata | `12 / 17` | 400 |
| Body | `13 / 19` | 400 |
| Quest content | `14 / 20` | 500 |
| Control | `13 / 18` | 500 |
| Panel title | `14 / 20` | 600 |
| Window title | `16 / 22` | 600 |

## 5. Spacing、Radius 与 Motion

### 5.1 Spacing

基础 spacing scale：`2, 4, 6, 8, 10, 12, 16, 20, 24px`。

- panel 内常规 padding：`12px`。
- toolbar 横向间隔：`6px`。
- 图标与文字间隔：`6px`。
- 高密度列表纵向 padding：`6–8px`。

### 5.2 Radius

`0, 2, 4, 6, 10, 12, 14px`。

- input / compact control：`6px`。
- Quest Card：`10px`。
- menu / popover：`6–10px`。
- right drawer 左侧外角：`12px`。
- dialog：`12px`。
- app 外层容器（适用时）：`14px`。
- 不使用 full radius；普通控件和内容卡片不超过 `12px`，仅 app 外层容器可使用 `14px`。

### 5.3 Motion

| Token | Duration | 用途 |
|---|---:|---|
| `motion.fast` | `80ms` | hover / pressed |
| `motion.normal` | `120ms` | selection / focus |
| `motion.panel` | `160ms` | panel collapse / expand |

使用标准 ease-out；不使用弹跳、缩放强调、长距离滑入或装饰性动画。遵守 Reduce Motion。

## 6. Component Metrics

| Component | Metric |
|---|---|
| Titlebar | `44px` 高 |
| Panel header / Status Lane Header | `40px` 高 |
| Sidebar row | `30px` 高 |
| Compact control | `28px` 高 |
| Search / text input | `30px` 高 |
| Quest Card | `104–132px`，`12–16px` padding，`10px` radius |
| Quest Drawer | 默认 `480px`，范围 `420–560px` |
| Drawer Action Bar | `64px` 高，固定底部 |
| Status split button | `32px` 高 |
| Icon | `14–16px` |
| Icon hit area | `28 × 28px` |
| Divider | `1px` 可见，`5px` resize hit area |
| Focus ring | `2px`，与控件保持 `1px` offset |

## 7. 核心组件

### 7.1 SidebarRow

状态：rest、hover、pressed、selected、focused、disabled、unavailable。

- selected 与 focused 必须可同时表达。
- unavailable 项目保留在列表中，使用 muted 文字和 warning icon，不自动移除。

### 7.2 ToolbarButton 与 SearchField

- ToolbarButton 可以是单图标；必须有 tooltip 与 accessibility label。
- SearchField 是受控输入，支持 `⌘F` 聚焦和 Escape 清除/退出搜索。
- 不用 pill 形状。

### 7.3 StatusLaneHeader 与 QuestCard

- StatusLaneHeader 不浮起、不加阴影；状态色点始终与文字并列。
- QuestCard 是可独立选择和拖拽的任务对象，使用 `104–132px` 高度和 `10px` radius。
- content 是唯一主信息，最多四行，使用 `13/18px` 和 `foreground`；不得从 content 中人为拆出 title。
- Created metadata 右对齐，使用 `11–12px`、regular weight 和 `muted-foreground`。
- 不增加 title、tag、priority、assignee 等字段，也不常驻显示删除或状态按钮。
- hover 只增强边框与柔和阴影，不移动卡片；selected 使用 `brand-subtle` 与 `brand` 左侧标记，focused 使用独立中性 ring。
- hover/focus 时显示 Lucide drag handle；Pointer 移动达到激活距离后整行均可拖。
- 拖拽时使用细描边、目标组 surface 与最终排序位置 indicator，不放大或旋转 Quest。

### 7.4 Quest Details Drawer

- Drawer 覆盖主列表，并通过 backdrop、左侧边缘和阴影表达 modal 层级。
- Header 包含标题、Previous、Next 和关闭图标；不展示 ID，也不放置删除动作。
- Content inline editor 是 Drawer 主体，不显示标题；rest 状态为透明背景、无边框、无圆角容器。
- 进入键盘或鼠标编辑状态时使用 focus indicator 表明可编辑区域，但不得改变正文位置。
- Created metadata 独立放在 editor 下方，不使用字段表格。
- 底部 Action Bar 始终固定，正文滚动时仍可见；顶部使用 edge-to-edge divider。
- Delete 位于左侧，默认采用 destructive ghost 样式；点击后打开确认对话框。
- 状态 split button 位于右侧：主按钮执行表格定义的默认流转，chevron 只负责打开替代状态菜单。
- split button 两段必须共享 focus group，同时允许分别通过键盘聚焦和触发。
- 自动保存 pending 或 saving 时 split button 保持可见；触发状态修改前必须先成功 flush content。
- 自动保存失败时在 Action Bar 上方显示紧凑错误与 Retry / Discard Local Changes，不在正常流程显示确认。

### 7.5 Banner 与反馈

- workspace 只读、路径失效、损坏文件等使用 panel 顶部紧凑 banner。
- banner 高度按内容自适应，通常为 `32–40px`。
- 保存成功使用短暂、非阻塞的轻量反馈，不移动现有布局。

## 8. Interaction States

每个交互组件至少定义：

```text
rest → hover → pressed
rest → focused
rest → selected
rest → disabled
rest → loading
rest → error
```

- hover 不等同 selected。
- active 表示正在执行或当前视图，pressed 只表示指针按下瞬间。
- focus 使用 `2px` ring，不能只靠颜色深浅。
- 状态信息不得只靠颜色；状态色点始终与文字并列。
- disabled 需要降低对比度并取消动作，但仍保持可读。

## 9. Keyboard-first 基线

键盘动作与快捷键属于 [Desktop 产品设计](./product.md)和 [Main Window 状态机](./main-window-state.md)。本视觉层要求所有可交互元素具备可见 focus、合理 tab order、tooltip 与 accessibility label；键盘状态不得造成 layout shift。

## 10. 真实页面状态

页面状态及转换由 [Main Window 状态机](./main-window-state.md)拥有。本视觉层统一规定其表现：

- Empty：使用紧凑 inline message，保留必要结构，不使用插画或大型空状态卡片。
- Loading：使用局部小型 progress indicator，不铺满 skeleton cards。
- Warning/Error：使用 workspace 顶部 compact banner；详情按需展开。
- Disabled：动作保持可辨识，通过对比度、cursor 与 tooltip 共同表达原因。
- Selected：Quest Card 使用 `brand-subtle` surface 与 `2px` brand 左侧标记，不改变几何尺寸；中性 focus ring 可同时出现。
- Conflict：提示靠近编辑区域，不使用阻断全屏错误页。

## 11. Quick Capture 与 Settings 的 Shell 一致性

### Quick Capture

- 使用同一 Light / Dark 语义 token、`30px` 紧凑控件和 `6px` 圆角。
- 固定为 `520 × 300`，采用一个连续、不透明的 `card` surface；外层使用 `14px` 原生圆角与 macOS 原生阴影表达悬浮层级，不增加外边框。HTML `body` 保持透明，不绘制第二层 canvas；窗口内部不使用 CSS 外围阴影或 editor 异色底板。
- 顶部 `44px` titlebar 左侧显示本地化窗口标题，使用 Window title 字体；右侧保留关闭按钮，除按钮外的标题与空白区域均可拖动窗口。
- content editor 与 titlebar、footer 共享同一表面，不使用常驻分隔线，依靠留白与布局关系区分区域。
- footer 高 `48px`；左侧是约 `180px` 的项目 selector，显示项目图标、截断项目名和 chevron，菜单向上展开；完整路径只在 tooltip 中提供。
- footer 右侧是品牌色 tinted surface 主操作按钮，文案为“提交”（英文 `Submit`）；Dark 使用 `brand-subtle` 背景、克制的 brand 边界与 `brand-foreground` 文字，避免高亮白色块。按钮内将 `⌘` 与 `Enter` 显示为两个紧凑 keycap。submitting 使用小型 progress，成功时原位变为 check + 已提交文案，不缩放或弹跳。
- 保存失败摘要固定在 editor 右下角，editor 为其预留空间；摘要不带 Retry 动作。只读或不可用项目在 selector 中显示 warning，并通过 tooltip 说明原因。
- 项目 selector、content editor、关闭与保存反馈采用与 Main Window 相同的状态语言；不添加多余 toolbar 或 panel。

### Settings

- Settings 替换 Main Window 的 Projects Sidebar 与 Quest Board，使用固定 `216px` Settings Sidebar + settings content panel 的连续结构；Sidebar 不支持 resize 或 collapse。
- Sidebar 顶部先保留完整 `48px` traffic lights 安全区；Back 位于其下方，与分类项同宽并共享尺寸、间距、hover 与 focus 样式。Back 下方使用轻量 Settings 小标题组织分类；General、Integrations、Tools、About 使用 Lucide 图标 + 文字，active 状态采用同一中性 accent surface，不改变几何尺寸。
- content panel 顶部只显示当前分类标题；内容列最大宽度 `760px`，靠左对齐。切换分类只替换右侧内容，不使用页内滚动锚点。
- section 依赖 divider 与标题层级，不堆叠 settings cards。窄窗口下 Sidebar 保持固定，设置行允许从左右布局自然换行为上下布局。
- 行布局保持左侧 label/description、右侧 compact control/status 的一致网格。
- Appearance 使用 Radio Group 语义和三段式视觉，选项为 System、Light、Dark。
- Settings 的全局成功与错误反馈复用 Sonner 右下角 toast，不新增第二套通知组件。

## 12. 产品与架构边界

本文件只拥有视觉与组件规格。产品行为以 [Desktop 产品设计](./product.md)和 [Main Window 状态机](./main-window-state.md)为准；技术边界以 [架构总览](../architecture/overview.md)为准。
