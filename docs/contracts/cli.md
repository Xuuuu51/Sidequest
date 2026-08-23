# `sq` CLI 公共契约

> 状态：稳定 Public API  
> 更新日期：2026-08-23

本文是 CLI 命令、JSON 输出、错误与 exit code 的唯一规范来源。字段或行为变更都需要明确兼容性评估。

## 1. 命令面

可执行文件固定为 `sq`：

```text
sq init
sq add
sq list
sq show
sq search
sq update
sq status
sq delete
```

全局参数：

```bash
sq --workspace <PATH> <COMMAND>
sq --json <COMMAND>
sq --version
sq --help
```

- 未指定 `--workspace` 时，从当前目录向父级解析 Workspace。
- 指定 `--workspace` 时，该路径是精确项目根目录，不向上解析。
- `init` 接收可选目标路径，默认当前目录，不使用 workspace resolution。

## 2. 命令语义

- `sq init [PATH]`：幂等初始化精确目录。
- `sq add <CONTENT> | --stdin`：二选一；创建 `inbox` Quest。
- `sq list [--status <STATUS>...] [--all]`：默认列出 `inbox` 与 `ready`；`--all` 包含 `done`，并与 `--status` 互斥。
- `sq show <ID>`：返回一个完整 Quest。
- `sq search <QUERY> [--status <STATUS>...]`：默认搜索全部状态；空白查询报错。
- `sq update <ID> <CONTENT> | --stdin`：只修改 content。
- `sq status <ID> <inbox|ready|done>`：设置状态。
- `sq delete <ID> [--yes]`：人工模式默认确认；脚本或 Agent 必须传 `--yes`。

`--json` 不隐式跳过删除确认；缺少 `--yes` 时直接返回错误，不进入交互。数据、排序和搜索规则见 [Quest 与存储契约](./quest-storage.md)。

## 3. JSON 成功响应

`--json` 是稳定公共 API。stdout 只包含一个 machine-readable JSON object，不得混入日志、提示、颜色码或确认问题。

每个响应固定包含：

```json
{
  "schema_version": 1,
  "workspace": "/absolute/path/to/project"
}
```

Quest DTO 固定为：

```json
{
  "id": "sq_01KABC1234567890ABCDEFGHJK",
  "created_at": "2026-08-22T22:30:00+08:00",
  "content": "Add fuzzy search to settings",
  "status": "inbox"
}
```

- Add、Show、Update、Status 在顶层 `quest` 字段返回落盘后的 Quest。
- List 与 Search 返回始终为数组的 `quests` 和 `issues`。
- 单文件损坏时仍返回其他 Quest，问题项固定为 `path` 与 `message`。
- Init 不增加 `initialized` 字段。
- Delete 返回 `{ "deleted": { "id": "..." } }`。
- 不直接序列化内部 Rust struct，必须使用显式版本化 DTO。

## 4. JSON 错误

JSON 模式失败时 stdout 为空，stderr 只输出一个对象：

```json
{
  "schema_version": 1,
  "error": {
    "code": "quest_not_found",
    "message": "Quest was not found",
    "path": null
  }
}
```

稳定 error code：

```text
invalid_arguments
invalid_content
confirmation_required
workspace_not_found
workspace_unavailable
workspace_read_only
quest_not_found
quest_file_invalid
io_error
internal_error
```

## 5. Exit codes

| Code | 含义 |
|---:|---|
| `0` | 成功；包括空结果与隔离损坏文件后的部分成功 |
| `1` | 未预期内部错误 |
| `2` | 参数、内容、查询或确认要求不合法 |
| `3` | Workspace 不存在、不可用或无效 |
| `4` | Quest 不存在 |
| `5` | 文件系统读取、写入或权限错误 |
| `6` | 请求的具体 Quest 文件损坏 |

Human-readable 输出不是稳定接口，可以在不改变命令语义的前提下优化。

