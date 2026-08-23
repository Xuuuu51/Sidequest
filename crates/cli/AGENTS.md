# CLI Implementation Guide

适用于 `crates/cli/`，并继承仓库根 `AGENTS.md`。

- 修改前读取 `docs/contracts/AGENTS.md`、`docs/contracts/cli.md` 和 `docs/architecture/core.md`。
- CLI 只负责参数解析、调用 `sidequest-core`、格式化输出和设置 exit code。
- 不在本 crate 重复 Workspace、Quest、validation、search 或 filesystem logic。
- JSON stdout 必须保持纯 machine-readable；diagnostics 只写 stderr。
- Binary integration tests 应调用实际 `sq` executable。
