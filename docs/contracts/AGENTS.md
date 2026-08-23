# Contract Change Guide

适用于 `docs/contracts/`。这里的文档是稳定公共契约，不是设计草稿。

修改前必须：

1. 说明对已有 Quest 文件、Workspace 解析或 CLI 消费者的兼容性影响。
2. 搜索实现、测试、Skill 和其他文档中的全部消费者。
3. 确认是否需要迁移、版本升级或旧数据兼容策略。

修改时：

- 不因 UI 方便而增加领域字段、状态或第二份数据源。
- Quest 文件、文件名、状态、Workspace resolution、CLI command 和 JSON 字段不得静默变化。
- contract 只描述外部可观察规则；内部类型与模块放到 `architecture/`。
- 三份 contract 之间使用链接，不复制共同段落。

修改后必须同步覆盖相应 contract/integration tests，并检查 Markdown 链接与重复规范。

