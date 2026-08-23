---
name: sidequest
description: Capture an explicitly requested future task in Sidequest, or recall and manage existing Sidequest quests when the user explicitly asks about them.
---

# Sidequest

Use the `sq` CLI as the only interface to Sidequest. Run commands from the relevant project directory so `sq` can resolve its workspace, or pass `--workspace <path>` when the user identifies another registered project.

## Capture

Create a quest only when the user clearly asks to remember, capture, or save something for later. Do not infer tasks from brainstorming, possibilities, or ordinary discussion.

Use:

```bash
sq --json add --stdin
```

Pass the user's content through standard input without inventing a title, priority, tags, deadline, or other fields.

## Recall and management

When explicitly asked, use the stable JSON interface:

- `sq --json list` for active quests; add `--all` only when completed quests are requested.
- `sq --json search <query>` to find matching content.
- `sq --json show <id>` to inspect one quest.
- `sq --json update <id> --stdin` to replace content.
- `sq --json status <id> <inbox|ready|done>` to change status.
- `sq --json delete <id> --yes` only after the user explicitly authorizes permanent deletion.

Read machine results from stdout and diagnostics from stderr. Surface failures instead of silently retrying mutations.

Never read or edit `.sidequest/` directly, invoke the Desktop GUI, create a workspace without an explicit request, or use an Agent SDK, daemon, or local API.
