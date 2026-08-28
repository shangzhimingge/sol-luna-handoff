# One-command npx installer design

## Goal

Make `npx -y github:shangzhimingge/sol-luna-handoff` install the complete Codex integration in one run: the Skill directory, six custom-agent definitions, and the managed global `AGENTS.md` activation block. A later manual `$sol-luna-handoff` invocation is not part of setup.

## Public interface

The repository becomes an executable npm package with a single `sol-luna-handoff` binary. With no command it behaves as `install`.

```text
sol-luna-handoff [install]
sol-luna-handoff doctor
sol-luna-handoff uninstall
sol-luna-handoff --help
```

`CODEX_HOME` selects the target Codex directory. When it is absent, the CLI uses `~/.codex`. Node.js 18 or newer is required, and the package has no runtime dependencies.

## Installation model

The CLI reads bundled content from `skill/sol-luna-handoff` and prepares these targets:

- `CODEX_HOME/skills/sol-luna-handoff`
- six files under `CODEX_HOME/agents`
- one marker-delimited block in `CODEX_HOME/AGENTS.md`

Every target is inspected before the first mutation. Exact current files are retained. Exact bundled historical agent definitions are eligible for migration. Unknown agent content, malformed global markers, or an installed Skill tree with unrecognized content aborts the entire operation before any target changes.

The Skill directory is staged beside the destination and exchanged only after preflight. File writes use same-directory temporary files and rename/replace operations. If a later mutation fails, the CLI restores snapshots created for the current run.

## Commands

### install

Installs or safely upgrades all components, verifies the resulting state, and prints a concise component summary. Re-running it is idempotent.

### doctor

Performs a read-only comparison against the bundled release. It reports each component as healthy, missing, or changed and exits nonzero when the complete installation is not healthy.

### uninstall

Preflights the installed Skill, agents, and managed block. It removes only content that matches the bundled release and preserves unrelated `AGENTS.md` text. Unknown modifications abort before removal.

## Documentation and release

`README.md` becomes the English primary document and links to `README.zh-CN.md`. Both place the GitHub-backed npx command first, explain all commands, and retain the manual PowerShell installer as a fallback. This feature is released as v1.3.0 because it adds a new public CLI without changing the routing contract.

## Verification

Node's built-in test runner covers first install, idempotence, `CODEX_HOME`, collision preflight, malformed markers, doctor drift detection, safe uninstall, and command errors. Packaging is verified with `npm pack --dry-run`, then the produced tarball is executed against an isolated Codex home.
