# Core Implementation Guide

适用于 `crates/core/`，并继承仓库根 `AGENTS.md`。

- 修改前读取 `docs/contracts/AGENTS.md`、相关 contract 和 `docs/architecture/core.md`。
- 本 crate 独占 Workspace、Quest、storage、search 与 domain error 行为。
- 不包含 CLI、Tauri、窗口、安装或 app-local state。
- 公共 API 必须有 rustdoc；fallible API 返回显式 `Result`，生产代码不使用 panic、unwrap 或 expect。
- 测试按行为命名，优先小型 unit test；跨模块公共行为使用 integration test。
