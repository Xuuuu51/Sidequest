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

- [ ] Sidebar、Board 和 Drawer 使用真实 Workspace 数据。
- [ ] Drawer selection、搜索和列滚动位置遵守状态机。
- [ ] Content 自动保存不会让旧响应覆盖新输入。
- [ ] 需要 flush 的导航在保存成功后自动继续。
- [ ] Status Button、drag 和 delete 的成功/失败状态正确。
- [ ] Read Only、Unavailable 和 Corrupt Files 状态正确。

## Search

依据：[Quest Storage Contract](../contracts/quest-storage.md)、[Main Window State](../desktop/main-window-state.md)

- [ ] 搜索只作用于当前项目。
- [ ] 查询、空结果和清除行为正确。
- [ ] 损坏文件不进入结果，并继续作为 issue 报告。

## Quick Capture

依据：[Desktop Product](../desktop/product.md)

- [ ] 全局快捷键可在其他应用前台时打开窗口。
- [ ] 多行输入、保存、关闭和失焦行为正确。
- [ ] 成功创建 Inbox Quest；失败保留输入。
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

发布前还必须完成干净 macOS 用户环境、项目异常、CLI/Desktop 并行修改、Quick Capture 多显示器和 Integration lifecycle 的人工 smoke test。

