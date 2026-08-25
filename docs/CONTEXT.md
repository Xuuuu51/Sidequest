# Sidequest 领域术语

> 状态：规范词汇表  
> 更新日期：2026-08-23

本文只定义项目语言，不包含数据格式、实现方式或交互流程。其他文档应链接到这里，不重复定义术语。

## 核心领域

**项目（Project）**  
用户明确交给 Sidequest 管理的一份本地软件项目。避免用“仓库”代替，因为项目不要求使用 Git。

**工作区（Workspace）**  
已经启用 Sidequest、能够保存和读取 Quest 的项目。避免用它指代 Desktop 项目列表或当前页面。

**Quest**  
值得记住、但不一定现在执行的一条开发意图。避免称为任务、工单、Issue 或笔记。

**Inbox**  
已经捕获、尚未决定何时处理的 Quest 状态。

**Ready**  
用户已判断可以进入近期执行范围的 Quest 状态。它不是自动排期或执行队列。

**Done**  
用户认为已经处理完成的 Quest 状态。

**捕获（Capture）**  
把用户明确表达的开发意图创建为 Quest。模糊讨论、猜测或可能性不构成捕获指令。

**回忆（Recall）**  
浏览或搜索已保存 Quest，以重新获得某个项目的历史意图。

## Desktop 上下文

**当前项目（Selected Project）**  
Main Window 当前正在浏览的已添加项目。

**不可用项目（Unavailable Project）**  
Desktop 仍保存其记录，但路径不存在或无法访问的项目。

**只读项目（Read-only Project）**  
当前能够读取 Quest、但不能写入 Sidequest 数据的项目。

**快速记录窗口（Quick Capture Window）**
用于从其他应用上方快速创建 Quest 的独立 Desktop 窗口。中文界面显示“快速记录”，英文领域名称和代码标识仍使用 Quick Capture；避免称为浮层、快速捕获或捕获页面。

**当前捕获项目（Capture Project）**  
Quick Capture Window 当前准备写入 Quest 的项目；它可以不同于当前项目。

**Quest 详情抽屉（Quest Details Drawer）**  
从 Main Window 右侧覆盖看板、用于查看和编辑当前 Quest 的面板。避免称为 Inspector、详情页或弹窗。

**操作栏（Action Bar）**  
Quest Details Drawer 底部承载删除与状态流转的固定区域。

**状态组合按钮（Status Split Button）**  
主按钮执行默认状态流转、独立菜单提供替代流转的组合控件。

**待自动保存内容（Auto-save Pending Content）**  
用户已经修改、但尚未确认写入完成的短暂界面状态。它不是第二份 Quest 数据或长期草稿。

## 界面译名

以下译名是 Desktop 简体中文资源的 canonical owner；英文 UI 保留英文列中的写法。

| English | 简体中文 |
|---|---|
| Projects | 项目 |
| Workspace | 工作区 |
| Inbox | 待整理 |
| Ready | 就绪 |
| Done | 已完成 |
| Quick Capture | 快速记录 |
| Capture（界面动作） | 记录 |
| Quest details | 详情 |
| Settings | 设置 |
| Read Only | 只读 |
| Unavailable | 不可用 |

`Sidequest` 与 `Quest` 在两种界面语言中均不翻译。中文界面在上下文明确时省略 `Quest`，并在需要计数时使用量词“条”，例如“3 条”和“删除这条 Quest？”。领域动作 Capture 仍称为“捕获”，但面向用户的操作文案使用更自然的“记录”。
