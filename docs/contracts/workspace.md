# Project 与 Workspace 契约

> 状态：稳定行为契约  
> 更新日期：2026-08-23

本文是项目目录、Workspace 初始化与解析语义的唯一规范来源。术语含义见 [领域术语](../CONTEXT.md)。

## 1. 有效 Workspace

项目目录中存在下列路径时，它才是有效 Workspace：

```text
<project>/.sidequest/
```

Desktop 保存的项目路径只是本机记录，不是 Workspace 的 Source of Truth。

## 2. 三种路径操作

| 操作 | 路径语义 | 使用方 |
|---|---|---|
| `init_workspace(path)` | 只在精确目录初始化，不向上查找；重复调用幂等成功 | Desktop、CLI init |
| `open_workspace(path)` | 只打开精确目录，不向上查找 | Desktop、CLI 显式 `--workspace` |
| `resolve_workspace(path)` | 从当前目录逐级向父目录查找 `.sidequest/` | CLI 默认行为 |

初始化创建 `.sidequest/quests/`。Desktop 添加项目时，所选文件夹本身就是项目根目录；不得解析到其父目录。

## 3. Desktop 项目记录

- 使用 canonical path 去重；重复添加同一路径不产生新记录。
- 嵌套目录可以各自成为独立项目。
- 切换项目失败时不得自动回退到另一个项目。
- 路径不存在或无法访问时标记为 unavailable，保留列表记录但禁止读写。
- Quest 可读但 `.sidequest/` 不可写时标记为 read-only，允许浏览与搜索，禁止写操作。

本机项目列表、最后选择项目和 UI 设置属于 Desktop app-local state，规范见 [Desktop 架构](../architecture/desktop.md)。

## 4. 移除与删除

默认 Remove Project 只移除 Desktop 的本机项目记录，不删除项目数据。

可选的 Delete Sidequest Data 必须：

- 经过用户明确确认；
- 只删除已打开的精确 `<workspace>/.sidequest/`；
- 永不删除项目根目录；
- 删除失败时保留 Desktop 项目记录并报告错误。

CLI MVP 不暴露删除整个 `.sidequest/` 的命令。

