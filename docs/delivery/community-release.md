# macOS Community Release

> 状态：当前社区预发布流程
> 更新日期：2026-08-25

本流程在没有 Apple Developer ID 与公证凭据时，通过 GitHub Releases 提供可审计的 macOS 测试包。它不替代 [Implementation Plan](./implementation-plan.md) 中正式公开版本要求的签名、公证、Universal DMG 与 Updater。

## 产物与信任边界

每个版本生成三个 Release assets：

```text
Sidequest_<version>_aarch64.dmg
Sidequest_<version>_x64.dmg
SHA256SUMS.txt
```

两个 DMG 分别包含同架构的 Desktop binary 与 `sq` CLI。应用使用 ad-hoc code signing，但未经 Apple 公证；GitHub Release 必须同时标记为 Draft 与 Prerelease，人工 smoke test 完成后才允许发布 Prerelease。

安装说明优先使用 Apple 支持的单次例外流程：先尝试打开应用，再到“系统设置 → 隐私与安全性”选择“仍要打开”。不得把清除 quarantine 的命令作为默认安装步骤。

## 版本与触发

发布前必须同步以下版本：

- 根 `Cargo.toml` 的 `workspace.package.version`；
- `apps/desktop/package.json`；
- `apps/desktop/src-tauri/tauri.conf.json`。

Release tag 使用 `v<semver>`，例如 `v0.1.0`；预发布 tag 可以使用 `v0.2.0-rc.1`。workflow 会拒绝 tag 与任一版本不一致的构建。

```bash
node apps/desktop/scripts/check-release-version.mjs v0.1.0
git tag -a v0.1.0 -m "Sidequest v0.1.0"
git push origin v0.1.0
```

推送 tag 后，`.github/workflows/release.yml` 执行 Release Gate，为 `aarch64-apple-darwin` 与 `x86_64-apple-darwin` 分别构建 `sq` 和 DMG，验证 code signature 与二进制架构，最后创建或更新 Draft Prerelease。

已有 tag 需要重跑时，从 GitHub Actions 手动触发 `Community Release` 并填写该 tag；workflow 始终 checkout tag，而不是当前分支。

## 人工发布检查

下载 workflow 生成的两个 DMG，并至少完成：

1. `sha256sum --check SHA256SUMS.txt` 或等价校验；
2. 在对应架构的干净 macOS 用户环境中安装到 `/Applications`；
3. 验证首次 Gatekeeper 提示与“仍要打开”流程；
4. 验证 Main Window、Quick Capture、项目读写与内置 `sq --version`；
5. 验证卸载或升级不会覆盖非 Sidequest-owned CLI 与 Skill；
6. 确认 Release notes 明确标注 ad-hoc 签名、未公证、架构选择与安装方式。

全部通过后，在 GitHub Release 页面发布 Draft，并保留 Prerelease 标记。正式签名与公证上线前，不得标记为 Latest stable release。
