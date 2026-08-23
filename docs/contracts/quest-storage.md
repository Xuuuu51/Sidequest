# Quest 与存储契约

> 状态：稳定公共契约  
> 更新日期：2026-08-23

本文是 Quest 数据、文件格式、排序、搜索与写入语义的唯一规范来源。修改本文须按兼容性变更处理。

## 1. 数据模型

Quest 只包含：

```text
id
created_at
content
status
```

用户只输入 `content`。不得增加 title、description、updated_at、tags、priority、deadline、assignee、estimate、Git context 或 AI metadata。

状态只有：

```text
inbox
ready
done
```

新 Quest 的默认状态是 `inbox`。`id` 使用 ULID，并带 `sq_` 前缀。`created_at` 使用带时区的 RFC 3339 时间。

## 2. 文件格式

每个 Quest 对应一个文件：

```text
.sidequest/quests/sq_<ulid>.md
```

文件格式固定为：

```markdown
---
created_at: 2026-08-22T22:30:00+08:00
status: inbox
---

Quest content
```

- ID 来自文件名，不写入 frontmatter。
- Markdown body 就是 `content`，不拆分标题与描述。
- 修改 content 不重命名文件；修改 status 不移动文件。
- frontmatter 不得增加其他字段。
- `.sidequest/` 是项目数据唯一 Source of Truth；MVP 不使用数据库或第二份 canonical data store。

## 3. 校验与读取

- `content` 允许多行，保留用户输入格式，但拒绝全空白内容。
- MVP 不设置人为字符数上限。
- 单个损坏文件必须隔离，并报告文件路径与错误；其他有效 Quest 继续加载。
- 不得静默覆盖或自动修复损坏文件。
- `list` 与 `search` 按 `created_at` 倒序排列；时间相同时按 `id` 倒序排列。

## 4. 搜索

搜索只扫描当前 Workspace 的 Quest 文件，对 `content` 做大小写不敏感的 substring match。

- 不使用数据库索引、FTS、embedding、semantic search 或 AI ranking。
- Core 的空查询等价于普通列表；CLI 对空白搜索参数的规则见 [CLI 契约](./cli.md)。

## 5. 写入与并发

创建、内容更新和状态更新必须使用安全写入流程：

```text
serialize
→ write temp file
→ flush/sync as appropriate
→ atomic rename
```

不得使用可能留下半写文件的 truncate-and-write。MVP 并发语义为 last write wins，不增加事务、分布式锁或同步系统。

删除 Quest 只删除匹配 ID 的单个 Quest 文件。Sidequest 只写文件，不自动执行 `git add`、`git commit` 或 `git push`。

