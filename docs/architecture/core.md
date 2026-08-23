# `sidequest-core` 架构

> 状态：实现基线  
> 更新日期：2026-08-23

本文定义 Rust Core 的公共接口与模块责任；行为细节以 [Quest 契约](../contracts/quest-storage.md)和 [Workspace 契约](../contracts/workspace.md)为准。

## 1. 公共类型

```rust
pub struct Workspace { /* private fields */ }
pub struct WorkspaceRoot(PathBuf);
pub enum WorkspaceAccess { Writable, ReadOnly }
pub struct QuestId(Ulid);

pub struct Quest {
    pub id: QuestId,
    pub created_at: DateTime<FixedOffset>,
    pub content: String,
    pub status: QuestStatus,
}

pub enum QuestStatus { Inbox, Ready, Done }
pub struct CreateQuest { pub content: String }
pub struct QuestCollection {
    pub quests: Vec<Quest>,
    pub issues: Vec<QuestFileIssue>,
}
pub struct QuestFileIssue { pub path: PathBuf, pub message: String }
```

使用语义类型封装路径和 ID，避免在边界中裸传含义不明的 `PathBuf` 或字符串。

## 2. Workspace API

```rust
pub fn init_workspace(project_root: &Path) -> Result<Workspace>;
pub fn open_workspace(project_root: &Path) -> Result<Workspace>;
pub fn resolve_workspace(start_path: &Path) -> Result<Workspace>;
```

三者的精确解析语义由 [Workspace 契约](../contracts/workspace.md)定义。

## 3. Quest API

```rust
impl Workspace {
    pub fn access(&self) -> Result<WorkspaceAccess>;
    pub fn create_quest(&self, input: CreateQuest) -> Result<Quest>;
    pub fn get_quest(&self, id: &QuestId) -> Result<Quest>;
    pub fn list_quests(&self) -> Result<QuestCollection>;
    pub fn update_quest_content(&self, id: &QuestId, content: String) -> Result<Quest>;
    pub fn set_quest_status(&self, id: &QuestId, status: QuestStatus) -> Result<Quest>;
    pub fn delete_quest(&self, id: &QuestId) -> Result<()>;
    pub fn search_quests(&self, query: &str) -> Result<QuestCollection>;
    pub fn delete_sidequest_data(self) -> Result<()>;
}
```

不提供通用 patch API。`delete_sidequest_data` 消耗 Workspace，只能删除该 Workspace 的 `.sidequest/`；CLI MVP 不暴露它。

## 4. 内部模块

```text
workspace  路径校验、初始化、解析
quest      领域类型与校验
storage    parse、serialize、安全文件写入
search     直接文本匹配与排序
error      稳定、可映射的错误类型
```

优先小模块、显式结构和直接 filesystem 操作。不预先引入 repository/service/use-case 多层、DI framework、复杂 trait 或只有单一实现的抽象。

## 5. 非 Core 责任

Desktop 项目列表与设置、窗口行为、文件 watcher、安装集成、UI debounce、CLI 参数/DTO/exit code 都不属于 Core。
