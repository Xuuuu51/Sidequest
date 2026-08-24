# MVP Acceptance

> 状态：实现基线

本文只定义可执行验收场景，不重新定义产品和接口规则。每个检查项都链接到其 canonical specification。

## Workspace 与项目

依据：[Workspace Contract](../contracts/workspace.md)、[Desktop Product](../desktop/product.md)

- [ ] Desktop 可以选择精确项目目录并完成初始化。
- [ ] 相同 canonical path 不产生重复项目记录。
- [ ] 嵌套目录可以成为独立项目。
- [ ] 项目列表与最后选择在重启后恢复。
- [ ] 默认移除项目不影响项目中的 Sidequest 数据。
- [ ] 显式删除 Sidequest 数据绝不作用于项目根目录。
- [ ] 移除最后一个项目后进入 Onboarding。
- [ ] CLI 可以从 Workspace 子目录解析根目录。

## Quest 与 Storage

依据：[Quest Storage Contract](../contracts/quest-storage.md)

- [ ] Create、Get、List、Content Update、Status Update、Delete 全部通过 Core。
- [ ] 多行 content 可以无损 round-trip。
- [ ] 全空白 content 被拒绝。
- [ ] Content 和 status 修改不改变 Quest 文件名或位置。
- [ ] 中断写入不会留下半写 canonical file。
- [ ] 单个损坏文件不会阻塞其他有效 Quest。
- [ ] List 与 Search 排序结果确定。

## Main Window

依据：[Desktop Product](../desktop/product.md)、[Main Window State](../desktop/main-window-state.md)、[Design System](../desktop/design-system.md)

- [ ] Sidebar、Grouped Quest List 和 modal Drawer 使用真实 Workspace 数据。
- [ ] 三个状态组共享单一滚动容器，sticky header、空组 drop target、selection 与滚动位置遵守状态机。
- [ ] Quest Row 固定高度、两行 content、创建时间与状态组表达符合 Design System。
- [ ] Toolbar `New Quest` 打开现有 Quick Capture 并聚焦输入，不创建第二套表单。
- [ ] Modal Drawer 的 backdrop、background inert、focus trap、Previous / Next、resize 和 focus restoration 正确。
- [ ] Content 自动保存不会让旧响应覆盖新输入。
- [ ] 需要 flush 的导航在保存成功后自动继续。
- [ ] Status Button、dnd-kit 跨组 drag、乐观移动/失败回滚和 delete 的成功/失败状态正确。
- [ ] Read Only、Unavailable 和 Corrupt Files 状态正确。

## Search

依据：[Quest Storage Contract](../contracts/quest-storage.md)、[Main Window State](../desktop/main-window-state.md)

- [ ] 搜索只作用于当前项目。
- [ ] 查询原位过滤三个状态组，匹配数量、空组 drop target、Previous / Next 范围和清除行为正确。
- [ ] 损坏文件不进入结果，并继续作为 issue 报告。

## Desktop UI 与主题

依据：[Design System](../desktop/design-system.md)、[Desktop Architecture](../architecture/desktop.md)

- [ ] Tailwind CSS 4、shadcn/ui Base UI base、Lucide 与 Sonner 按架构固定；未引入整套 blocks 或第二套 icon/toast system。
- [ ] 不存在旧 `App.css`、feature CSS、Phosphor import、feature 对 Base UI 的直接 import 或组件内 raw palette color。
- [ ] Main Window 与 Quick Capture 使用独立动态 application root；Quick Capture chunk 不包含 Main Window、Settings 或 Onboarding 主体。
- [ ] Main Window 只使用一个由四个 slice 组合的内存 Zustand store；Tauri-backed DTO 只进入 TanStack Query，每个 feature 只有一个 `data.ts`。
- [ ] System、Light、Dark 偏好可持久化并即时同步 Main Window、Quick Capture、Onboarding、Settings 与原生窗口外观。
- [ ] Theme mutation 失败保留旧主题；主题切换不重建 QueryClient/Zustand 或丢失任何 draft。
- [ ] Focus 使用高对比中性 ring；selection 与 focus 可同时表达；Inbox、Ready、Done 状态不只靠颜色。
- [ ] 人工视觉矩阵覆盖 Main Window、Quick Capture、Onboarding、Settings 的 Light/Dark、默认/最小尺寸、modal、拖拽、键盘焦点、错误、只读与 reduced motion。

## Quick Capture

依据：[Desktop Product](../desktop/product.md)

- [ ] 全局快捷键可在其他应用前台时打开窗口。
- [ ] 全局快捷键可在其他应用的原生全屏 Space 上方原地打开窗口，不切换 Space。
- [ ] 多行输入、保存、关闭和失焦行为正确。
- [ ] 成功创建 Inbox Quest；失败保留输入。
- [ ] 标题拖拽、footer 项目菜单、按钮成功反馈与 editor 右下角失败摘要正确。
- [ ] 上次项目与有效窗口位置得到恢复。
- [ ] Main Window 可以观察到外部创建。

## CLI

依据：[CLI Contract](../contracts/cli.md)

- [ ] 所有 MVP commands 通过 binary integration tests。
- [ ] Workspace、stdin、filter 和 confirmation 参数正确。
- [ ] JSON DTO、error code 和 exit code 与 Contract 一致。
- [ ] JSON stdout 不包含日志或交互提示。
- [ ] 空结果与包含隔离问题的 collection 正常返回。

## Distribution

依据：[Distribution Architecture](../architecture/distribution.md)

- [ ] managed CLI 可以默认安装、卸载和 repair。
- [ ] 用户主动卸载意图得到保留。
- [ ] Codex 与 Claude Code Skill 可以分别管理。
- [ ] modified 或 external installation 不被静默覆盖或删除。
- [ ] Integration 失败不阻塞本地 Quest 功能。

## 稳定性与隔离调试

依据：[Desktop Architecture](../architecture/desktop.md)

- [ ] Debug 与普通构建使用正确日志级别，日志按 1 MiB 轮转且只保留一个历史文件。
- [ ] 日志不包含 Quest content、搜索词、剪贴板内容或未脱敏的 Home 路径。
- [ ] 诊断摘要不包含用户名、项目绝对路径、Quest 数据或完整日志。
- [ ] Main Window 与 Quick Capture render error、未处理 Promise 和 listener 失败可定位。
- [ ] Main Window reload 经过写入保护；Quick Capture 有草稿时阻止 reload。
- [ ] Release build 不接受隔离 Profile override，也不包含 Debug 菜单。
- [ ] `desktop:isolated:reset` 只删除精确的仓库内 debug profile，不跟随 symlink。
- [ ] 隔离 Profile 中 CLI 与 Agent Skill 操作不接触真实 Home；Launch at Login 不可修改。
- [ ] 红色关闭、Dock/menu reopen、跨组拖拽与 watcher event storm 回归通过。

## 多语言

依据：[Desktop Product](../desktop/product.md)、[Desktop Architecture](../architecture/desktop.md)、[术语表](../CONTEXT.md)

- [ ] 首次渲染使用 native 确定的有效 locale，不出现英文 fallback 闪烁。
- [ ] 跟随系统、English 与简体中文偏好可以持久化；保存失败时保持原界面和菜单。
- [ ] Main Window、Quick Capture、Onboarding、Settings 与原生菜单使用一致语言，切换时保留草稿和 UI workflow state。
- [ ] 英文与简体中文资源 key/插值占位符一致；英文 fallback、简体中文 smoke、日期与错误映射测试通过。
- [ ] UI 不展示原始 backend message/path，CLI contract、Quest content、日志与诊断摘要不被翻译。

## Release Gate

依据：[Implementation Plan](./implementation-plan.md)

```text
cargo fmt --check
cargo clippy --workspace
cargo test --workspace
pnpm lint
pnpm typecheck
pnpm test
pnpm tauri build
```

阶段 8 使用隔离 Profile 完成同等范围的调试 smoke test。阶段 9 发布前还必须完成干净 macOS 用户环境、项目异常、CLI/Desktop 并行修改、Quick Capture 多显示器、Integration lifecycle、签名、公证、Universal DMG 与 Updater 的人工 smoke test。
