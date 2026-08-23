# Desktop Application Shell 与 Design System

> 状态：已确认设计基线  
> 确认日期：2026-08-23  
> 平台：macOS Desktop MVP  
> 设计密度：8/10 · 设计变化度：3/10 · 动效强度：2/10

## 1. 目标

Sidequest Desktop 采用克制、专业、高密度的 developer tool 视觉语言。界面应首先像一个长期使用的桌面生产力工具，而不是网页仪表盘、营销页面或移动 App。

本基线参考 Codex Desktop、Linear、Cursor 和 VS Code 的信息组织方式，但只借鉴视觉语言与桌面端交互原则，不引入聊天、代码编辑器、Agent 面板等 Sidequest 产品范围之外的功能。

核心原则：

- 连续工作区优先，减少独立卡片和容器套嵌。
- sidebar、toolbar、panel、divider 构成主要层级。
- 小字号、紧凑间距和明确状态服务于高频操作。
- 深色模式优先设计，通过语义 token 完整兼容浅色模式。
- 键盘与鼠标操作同等重要；焦点状态不可省略。
- 不使用 AI 紫色渐变、玻璃拟态、大圆角、KPI 卡片、三等宽卡片网格和花哨动画。
- Taste 类规则只采用 typography、spacing、visual consistency 与 anti-slop 原则，不采用 landing page 结构。

## 2. Application Shell

### 2.1 总体结构

```text
┌──────────────────────────────────────────────────────────────────┐
│ Titlebar：窗口控制 / 当前项目 / Search / Panel Toggle           │ 44
├──────────────┬────────────────────────────────┬──────────────────┤
│ Project      │ Board Workspace                │ Quest Drawer     │
│ Sidebar      │ ┌─────────┬─────────┬────────┐ │                  │
│              │ │ Inbox   │ Ready   │ Done   │ │                  │
│              │ │ rows    │ rows    │ rows   │ │                  │
│              │ └─────────┴─────────┴────────┘ │                  │
│ Settings     │                                │                  │
└──────────────┴────────────────────────────────┴──────────────────┘
```

- 默认窗口：`1280 × 800`。
- 最小窗口：`1024 × 640`。
- Titlebar 高度：`44px`。
- Sidebar 与 Board 之间使用 `1px` divider；可拖动分隔条的实际命中区为 `5px`。
- 主界面主要依靠背景层级和分隔线。只有右侧抽屉使用克制阴影表达覆盖关系。

### 2.2 Project Sidebar

- 默认宽度 `224px`，最小 `180px`，最大 `320px`。
- Sidebar 是从窗口顶部贯穿到底部的完整表面，右侧 `1px` divider 连续延伸至窗口顶边。
- Sidebar 内不显示 Titlebar 底部分隔线；主工作区的 Titlebar 分隔线从 Sidebar 右侧 divider 开始。
- 支持拖动调整宽度，宽度写入 Desktop app-local JSON。
- 支持收起为 `44px` icon rail；恢复后使用上次宽度。
- 收起/展开按钮位于 Sidebar 顶部右侧、divider 左边，不占用主工作区 Titlebar。
- `Projects` 是纯文字 section heading，不带文件夹图标；右侧保留添加项目图标。
- 项目行高 `30px`，图标 `15px`，文字 `13px`。
- 选中态使用轻微的 surface-selected 背景和左侧/文字强调，不使用大型圆角胶囊。
- `Settings` 固定在底部并保留文字，其上方 divider 左右贴齐 Sidebar 边缘。

### 2.3 Titlebar 与 Toolbar

- 当前项目名称位于 Sidebar divider 右侧的主工作区 Titlebar。
- Search 是可直接输入的紧凑搜索框，不退化为单独搜索图标。
- 右侧只保留具有全局含义的 panel toggle；Quest 删除等上下文动作不进入全局 toolbar。
- 图标默认 `14–16px`，命中区域 `28px`。
- 图标按钮使用 tooltip，并具备清晰 hover、pressed、focus 状态。

### 2.4 Board Workspace

- Board 是连续的 Kanban 平面，Lane 保持平整，Quest 使用独立任务卡片。
- Board 内容区使用 `surface.workspace`，与更深的 `surface.sidebar` 形成克制但明确的层级差异。
- 三个 lane 通过竖向 divider 分隔，建议初始比例为 `38% / 31% / 31%`，允许窗口变化时弹性伸缩。
- Lane header 高度 `36px`，包含状态色点、名称、数量和 lane menu。
- Lane 内边距与卡片间距为 `10–12px`，避免形成机械的三等宽 card grid。
- Quest Card 默认最小高度 `88px`，通常不超过 `110px`；内容较长时自然增高。
- 选中 Quest 使用 `2px` selection border、轻微背景变化和可见 focus ring。
- 状态颜色只用于色点、selection indicator 等小面积识别，不铺满整列或整张 Quest。
- 列内排序继续遵守已确认规则：按创建时间排序。

### 2.5 Quest Details Drawer

- Quest 详情采用从右侧打开的 overlay drawer，覆盖 Board，不压缩三列的基础宽度。
- 默认宽度 `480px`，最小 `420px`，最大 `560px`。
- 支持从左边缘拖动调整宽度；宽度写入 Desktop app-local JSON。
- Drawer 左上、左下圆角为 `10px`，通过清晰左边界和克制阴影表达覆盖关系。
- Header 高度 `44px`，标题为 `Quest details`，只保留关闭动作。
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
- 点击关闭图标或按 `Esc` 关闭 drawer，不取消 Board 中的 Quest 选择。

状态 split button 的动作映射见 [Desktop 产品设计](./product.md)。

Done 没有后续状态，因此主按钮采用最常见的恢复动作 `Move to Ready`，菜单保留完全重置到 Inbox 的入口。

## 3. Design Token 架构

组件不得直接使用原始 hex。采用三层 token：

```text
Primitive → Semantic → Component
gray.950     surface.canvas    sidebar.background
blue.400     focus.ring        input.focusRing
```

### 3.1 Primitive Color

| Token | Dark | Light |
|---|---:|---:|
| `gray.000` | `#FFFFFF` | `#FFFFFF` |
| `gray.050` | `#F5F5F6` | `#F5F5F6` |
| `gray.100` | `#EEEEF0` | `#EEEEF0` |
| `gray.200` | `#DEDFE4` | `#DEDFE4` |
| `gray.300` | `#D4D4D8` | `#D4D4D8` |
| `gray.500` | `#71717B` | `#71717B` |
| `gray.600` | `#60616A` | `#60616A` |
| `gray.700` | `#3A3A42` | `#3A3A42` |
| `gray.800` | `#2B2B31` | `#2B2B31` |
| `gray.850` | `#232327` | `#232327` |
| `gray.900` | `#1E1E22` | `#1E1E22` |
| `gray.925` | `#18181B` | `#18181B` |
| `gray.950` | `#141416` | `#141416` |
| `gray.975` | `#111113` | `#111113` |
| `slate.050` | `#F3F5F7` | `#F3F5F7` |
| `slate.900` | `#1A2026` | `#1A2026` |

状态与交互色：

| Token | Value | 用途 |
|---|---:|---|
| `blue.400` | `#7AA2F7` | focus / selection |
| `status.inbox` | `#6F95D8` | Inbox 标识 |
| `status.ready` | `#C6944B` | Ready 标识 |
| `status.done` | `#63A779` | Done 标识 |
| `danger.400` | `#DF6A6A` | 删除与错误 |

### 3.2 Semantic Color

| Semantic token | Dark mapping | Light mapping |
|---|---|---|
| `surface.canvas` | `gray.975` | `gray.050` |
| `surface.sidebar` | `gray.950` | `gray.100` |
| `surface.workspace` | `slate.900` | `slate.050` |
| `surface.panel` | `gray.925` | `#FAFAFB` |
| `surface.raised` | `gray.900` | `gray.000` |
| `surface.hover` | `gray.850` | `#E8E8EB` |
| `surface.selected` | `#2A2A30` | `gray.200` |
| `border.default` | `gray.800` | `gray.300` |
| `border.strong` | `gray.700` | `#B8B8BF` |
| `text.primary` | `#ECECEF` | `#202124` |
| `text.secondary` | `#A3A3AD` | `gray.600` |
| `text.muted` | `gray.500` | `gray.500` |
| `focus.ring` | `blue.400` | `#3976D3` |

### 3.3 Component Token

```text
questCard.background       → surface.raised
questCard.border           → border.default
questCard.borderHover      → border.strong
questCard.borderSelected   → focus.ring
questCard.radius           → radius.8
questCard.padding          → space.12
questCard.contentColor     → text.primary
questCard.contentType      → type.questContent
questCard.metadataColor    → text.muted
questCard.metadataType     → type.metadata

questDrawer.background     → surface.panel
questDrawer.border         → border.strong
questDrawer.radiusLeft     → radius.10
questDrawer.widthDefault   → size.480
questDrawer.shadow         → shadow.drawer
questDrawer.actionBarHeight → size.64
questDrawer.actionBarBg    → surface.panel
questDrawer.actionBarBorder → border.default
statusSplitButton.height   → size.32
questContent.background    → transparent
questContent.border        → none
questContent.focusRing     → focus.ring
questContent.autoSaveDelay → motion.autoSaveDelay
questContent.saveStatus    → text.muted
```

`shadow.drawer` 只用于表达抽屉覆盖 Board 的层级；Quest Card rest 状态不使用明显阴影。

## 4. Typography

- UI 字体：`SF Pro Text`, `-apple-system`, `BlinkMacSystemFont`, sans-serif。
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

`0, 2, 4, 6, 8, 10, 12px`。

- input / segmented control：`8px`。
- Quest Card：`8px`。
- menu / popover：`8px`。
- right drawer 左侧外角：`10px`。
- dialog：`12px`。
- 不使用 full radius；普通内容不超过 `12px`。

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
| Panel header / Lane header | `36px` 高 |
| Sidebar row | `30px` 高 |
| Compact control | `28px` 高 |
| Search / text input | `30px` 高 |
| Quest Card | `88px` 最小高度，`10–12px` padding，`8px` radius |
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

### 7.3 LaneHeader 与 QuestCard

- LaneHeader 不浮起、不加阴影。
- QuestCard 是可独立选择和拖拽的任务对象，使用 `surface.raised`、`border.default` 和 `8px` radius。
- 卡片内容是唯一主信息，使用 `14/20px`、medium weight 和 `text.primary`；不得从 content 中人为拆出 title。
- Created metadata 位于底部，使用 `11–12px`、regular weight 和 `text.muted`，与 content 保持明确纵向间距。
- 卡片保持 `12px` 内边距；不增加 title、tag、priority、assignee 等字段。
- hover 只提升边框对比度和轻微改变背景；selected 使用 selection border 与 focus 表达。
- 仅 hover 时允许极轻的 `shadow-xs`；rest 状态不使用明显阴影。
- 拖拽时使用细描边和插入位置 indicator，不放大或旋转 Quest。

### 7.4 Quest Details Drawer

- Drawer 覆盖 Board，并保持左侧边缘和下层内容关系清楚。
- Header 只包含标题和关闭图标；不展示 ID，也不放置删除动作。
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
- Selected：卡片使用清晰边框与 surface 差异，不改变几何尺寸。
- Conflict：提示靠近编辑区域，不使用阻断全屏错误页。

## 11. Quick Capture 与 Settings 的 Shell 一致性

### Quick Capture

- 使用同一 dark-first token、`30px` 紧凑控件和 `8px` 圆角。
- 项目 selector、content editor、关闭与保存反馈采用与 Main Window 相同的状态语言。
- 不添加多余 toolbar 或 panel。

### Settings

- 使用 Sidebar + settings content panel 的连续结构；section 依赖 divider 与标题层级，不堆叠 settings cards。
- 行布局保持左侧 label/description、右侧 compact control/status 的一致网格。

## 12. 产品与架构边界

本文件只拥有视觉与组件规格。产品行为以 [Desktop 产品设计](./product.md)和 [Main Window 状态机](./main-window-state.md)为准；技术边界以 [架构总览](../architecture/overview.md)为准。

## 13. 参考图

![Sidequest Desktop application shell dark proposal](../assets/sidequest-application-shell-dark-v6.png)

这张图用于确认信息架构、密度、panel 关系和视觉语言，不是逐像素实现规格。最终实现以本文件中的 token、组件尺寸和状态定义为准。
