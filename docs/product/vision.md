# Sidequest 产品愿景

> 状态：产品愿景基线，非实现规格  
> 更新日期：2026-08-23

本文只说明 Sidequest 为什么存在、服务谁，以及产品判断遵循什么原则。术语见 [领域术语](../CONTEXT.md)，可交付范围见 [MVP Scope](./mvp-scope.md)。

## 1. 产品定义

Sidequest 是面向软件项目的本地优先项目记忆层。它保存开发过程中暂时不做、但值得以后重新发现的意图，并让这些意图与产生它们的项目一起存在。

> Stay on the main quest without losing the sidequests.

## 2. 用户问题

开发者在实现当前目标时，经常发现另一件值得做的事：重构机会、边界情况、体验改进或后续验证。

立即处理会打断 flow；传统项目管理工具过于正式；聊天记录难以跨 session 找回；代码 TODO 又容易把局部提醒与项目级意图混在一起。Sidequest 提供低摩擦的中间层：现在记下，以后按项目重新发现。

## 3. 核心用户

- 长时间在本地代码项目中工作的个人开发者。
- 使用 Markdown、Git、CLI 和 Coding Agent 的 developer-tool 用户。
- 经常遇到旁支想法，但不希望立即切换上下文的人。

Sidequest 不是团队项目管理系统，也不是通用个人待办应用。

## 4. 核心价值

- Capture：不离开当前应用，迅速记录一条开发意图。
- Recall：从项目上下文中浏览和搜索曾经保存的意图。
- Re-evaluate：在合适的时间重新判断是否开始或完成它。

这些词的领域含义统一由 [领域术语](../CONTEXT.md)维护，不在本文件定义数据结构。

## 5. 产品原则

### Capture now, organize later

捕获必须轻量，不能先要求用户进入完整规划流程。

### Stay on the main quest

记录过程短、可预测，并尽快把焦点还给原来的工作。

### Files are the Source of Truth

用户应能直接理解、复制和版本控制自己的数据，不依赖 Sidequest 服务才能取回。

### Repository-native, not Git-dependent

数据可以跟随项目进入 Git，但 Sidequest 不替用户决定是否提交，也不要求项目本身是 Git repository。

### Agent through a stable protocol

Coding Agent 使用与人类脚本相同的稳定 CLI 协议，而不是获得隐藏的数据访问通道。

### Local-first and understandable

首版不依赖账号、云端或不透明的智能整理。产品行为应确定、可解释、可测试。

