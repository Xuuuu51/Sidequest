<p align="right">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/readme/hero-dark.svg">
    <img src="./assets/readme/hero-light.svg" width="100%" alt="Sidequest — local-first project memory that saves side ideas without interrupting your main flow">
  </picture>
</p>

<p align="center">
  <a href="#stay-on-the-main-quest">Why Sidequest</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#command-line">CLI</a> ·
  <a href="./docs/README.md">Docs</a>
</p>

![Sidequest for macOS showing multiple projects, the Inbox, Ready, and Done board, and an editable Quest details drawer](./docs/assets/sidequest-application-shell-dark-v6.png)

<p align="center"><sub>One project. Three states. Every idea stays close to the code that inspired it.</sub></p>

## Stay on the main quest

While building one thing, you notice another: a refactor, an edge case, a UX improvement, or a follow-up worth validating.

Doing it now breaks your flow. A project-management tool is too heavy. Chat history is hard to rediscover, and a code TODO is often the wrong home for project-level intent.

Sidequest gives those thoughts a quiet place to wait:

- **Capture in seconds.** Open Quick Capture from anywhere with <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd>, write the thought, and return to work.
- **Recall in context.** Browse and search the Quests attached to the current project, then move them through `Inbox`, `Ready`, and `Done`.
- **Own the memory.** Every Quest is plain Markdown on your filesystem—no account, database, daemon, or cloud dependency.

Sidequest is for individual developers working in local code projects. It is intentionally not a team issue tracker or a general-purpose to-do app.

## How it works

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="Quick Capture, the desktop app, the CLI, and coding agents share one Rust core and local Markdown store for later recall">
</p>

The desktop app, `sq` CLI, and installed Codex or Claude skills all go through the same Rust core. Storage, validation, workspace resolution, search, and safe writes therefore have one implementation—not a separate source of truth for every interface.

### Files are the source of truth

Each Quest is one readable file inside the project it belongs to:

```text
your-project/
└── .sidequest/
    └── quests/
        └── sq_01KABC1234567890ABCDEFGHJK.md
```

```markdown
---
created_at: 2026-08-22T22:30:00+08:00
status: inbox
---

Handle the read-only workspace state.
```

The files are portable, inspectable, easy to back up, and Git-friendly when you choose to version them. Sidequest never runs `git add`, `git commit`, or `git push` for you.

## Get started

Sidequest is currently an early macOS MVP that runs from source.

### Prerequisites

- macOS with the Xcode command-line toolchain
- Node.js 24
- pnpm 11.7 or later in the 11.x line
- Rust 1.98.0

Clone the repository and launch the Tauri desktop app:

```bash
git clone https://github.com/Xuuuu51/Sidequest.git
cd Sidequest
pnpm install
pnpm desktop
```

On first run, add a project and choose whether to configure Quick Capture and coding-agent integrations. The app can install its bundled `sq` CLI for you.

## What is included

- Multi-project macOS desktop app
- `Inbox`, `Ready`, and `Done` Quest board
- Global, always-on-top Quick Capture window
- Current-project search and editable Quest details
- Safe atomic writes and malformed-file isolation
- Native `sq` CLI with human-readable and stable JSON output
- Managed Codex and Claude skill integrations

## Command line

To use the CLI independently of the desktop app, install it through Cargo:

```bash
cargo install --path crates/cli
```

Then initialize a project and capture your first Quest:

```bash
sq init /path/to/project
cd /path/to/project

sq add "Handle the read-only workspace state"
sq list
sq search "workspace"
```

```text
sq init      Initialize a Sidequest workspace
sq add       Capture a new Quest
sq list      List active Quests
sq show      Show one Quest
sq search    Search the current project
sq update    Edit Quest content
sq status    Move a Quest between states
sq delete    Delete one Quest
```

Use `sq --json <COMMAND>` for the versioned machine-readable interface used by scripts and coding agents. The [`sq` CLI contract](./docs/contracts/cli.md) defines its arguments, JSON shapes, errors, and exit codes.

## Scope

The MVP deliberately stays small. It does not include Windows or Linux apps, cloud sync, team collaboration, external issue-tracker integrations, semantic search, or automatic Quest execution. Signed public releases and automatic updates are not yet documented as available.

See the [MVP scope](./docs/product/mvp-scope.md) for the exact product boundary and the [documentation map](./docs/README.md) for product, contracts, architecture, desktop behavior, and delivery guidance.

## Development

| Area | Technology |
| --- | --- |
| Core | Rust |
| CLI | Rust + clap |
| Desktop | Tauri 2 + React + TypeScript |
| Server state | TanStack Query |
| UI state | Zustand |
| Storage | Markdown + YAML frontmatter |

Run the common checks from the workspace root:

```bash
pnpm format:check
cargo clippy --workspace
cargo test --workspace
pnpm lint
pnpm typecheck
pnpm test
```

The complete release gate and manual smoke-test requirements live in the [acceptance checklist](./docs/delivery/acceptance.md).

## License

Sidequest is available under the [MIT License](./LICENSE).
