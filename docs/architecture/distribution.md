# Desktop Integration 与分发

> 状态：实现基线  
> 更新日期：2026-08-23

本文是 Desktop 随附 CLI、Codex/Claude Skill 的打包、安装、检测、升级与卸载规则的唯一规范来源。Settings 的界面文案和入口见 [Desktop 产品设计](../desktop/product.md)。

## 1. Bundle ownership

Desktop app bundle 内包含同版本的：

```text
sq executable
Sidequest SKILL.md
```

Desktop 安装器拥有它安装出去的副本；不得修改用户手工安装且无法确认归属的同名文件。CLI、Skill 和 Desktop 的可分发版本必须来自同一 release。

## 2. CLI

首次完成 Desktop onboarding 时默认安装 `sq`，不设置为可跳过步骤；安装失败不阻止用户进入主窗口，但必须展示可恢复状态。

安装要求：

- 目标是当前用户可执行且通常位于 shell `PATH` 的位置。
- 使用 app bundle 中的 native binary，不依赖 Node/Bun/Deno。
- 重复安装同时承担 verify/repair。
- 检测至少校验文件存在、可执行、归属标记和版本。
- Desktop 升级后，若目标由当前 app 管理且版本落后，允许自动替换。
- 用户可以在 Settings 中单独卸载 CLI；卸载不影响 Desktop 或项目数据。

如果目标路径被不同来源占用，状态显示 Conflict，不覆盖；向用户说明现有路径并提供恢复指引。

## 3. Agent Skills

MVP 只支持：

| Agent | 安装目录 |
|---|---|
| Codex | `~/.codex/skills/sidequest/` |
| Claude | `~/.claude/skills/sidequest/` |

每个目录安装一份完整、可独立读取的 `SKILL.md`。Skill 只指导 Agent 识别明确的 Capture/Recall 意图并调用 [`sq` CLI](../contracts/cli.md)，不得直读 Quest 文件、调用 GUI、引入 Agent SDK 或建立第二条协议。

Skill 不随首次 onboarding 强制安装；用户从 Coding Agents 设置中分别安装、修复或卸载。安装程序必须：

- 创建缺失的父目录；
- 只覆盖能够确认由 Sidequest 管理的副本；
- 检测缺失、版本落后、内容损坏和路径冲突；
- 卸载时只移除 Sidequest 管理的目录，不影响 Agent 的其他 Skill。

## 4. 状态模型

CLI 和每个 Agent integration 对外统一映射为：

```text
installed
notInstalled
updateAvailable
repairRequired
conflict
unavailable
```

UI 可以把无需用户理解的细分原因合并展示，但 backend 必须保留足够诊断信息。状态检测不得把“目录存在”直接视为安装成功。

## 5. 失败与升级

- 安装、升级和卸载必须原子化，失败不得留下半写文件。
- Integration 失败不影响 Quest 读写和 Desktop 主流程。
- Desktop 启动或 Settings 打开时可以重新检测；MVP 不运行常驻后台服务。
- CLI 与 Skill 的安装逻辑属于 Tauri backend integration 模块，不进入 `sidequest-core`。

