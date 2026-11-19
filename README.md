# Sol → Luna Handoff

> **2.0 uses one workflow: Sol plans and verifies; Luna discovers and executes.** Every tier executes with Luna. The former profile selector and Terra execution lane are retired.

[简体中文](README.zh-CN.md)

## Install

```bash
npx -y github:shangzhimingge/sol-luna-handoff
```

This installs the Skill, five custom agents, the global activation rule, and the sole workflow configuration:

```json
{
  "schemaVersion": 2,
  "workflow": "sol-luna"
}
```

Start a new Codex task after installation so agent discovery refreshes.

## The workflow

| Tier | Predicate summary | Route |
| --- | --- | --- |
| **Tier 1** | ≤2 files, ≤100 lines, one subsystem, explicit acceptance, no Tier 3 predicate | `luna_fast_executor` implements and self-verifies |
| **Tier 2** | Default when Tier 3 is false and Tier 1 is not fully satisfied | Conditional Luna Scout → optional compact Sol plan → `luna_executor` → evidence-triggered Sol verification |
| **Tier 3** | Large, architectural, destructive, security-sensitive, deployment, public API, dependency migration, concurrency, or unbounded work | Conditional Luna Scout → full Sol plan → `luna_executor` → mandatory Sol verification |

The final decision is always emitted in this form:

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna
```

Tier thresholds, conditional Scout triggers, correction limits, and evidence budgets remain deterministic. If Luna discovers a missing binding decision or scope beyond the brief or plan, it stops before further edits and returns preserved evidence for Sol replanning.

## Agents

| Agent | Model / reasoning | Sandbox | Role |
| --- | --- | --- | --- |
| `sol_planner` | `gpt-6.2-sol` / high | read-only | Tier 3 planning and verification; evidence-triggered verification |
| `sol_compact_planner` | `gpt-6.2-sol` / medium | read-only | Bounded Tier 2 replanning |
| `luna_scout` | `gpt-6-luna` / low | read-only | Compressed discovery evidence |
| `luna_executor` | `gpt-6-luna` / medium | workspace-write | Tier 2 and Tier 3 implementation |
| `luna_fast_executor` | `gpt-6-luna` / low | workspace-write | Tier 1 direct implementation |

## Model selection (2.1)

The preferred pair is **`gpt-6.2-sol` / `gpt-6-luna`**. The preferred Luna model is also the offline default. Automatic model discovery can select a newer compatible Luna model when it appears in the fresh Codex model catalogue.

- **Automatic (default):** on installation and Skill preflight, select the highest numeric version in each family from the local Codex model cache (up to seven days old). It uses no network and starts no background task. If the cache is missing, stale, or temporarily lacks a family, keep the last selected model for that family.
- **Inspect:** `npx -y github:shangzhimingge/sol-luna-handoff models status` shows installed, preferred and proposed models. It is read-only.
- **Refresh now:** replace `status` with `refresh`.
- **Pin a pair:** use `models set --sol gpt-6.2-sol --luna gpt-6-luna` with a fresh cache that lists both. Use `models auto` to resume automatic selections.

The preference lives in `$CODEX_HOME/sol-luna-models.json`. The installer refreshes the five managed TOMLs without changing role prompts, reasoning effort or sandbox. Use Node.js 18+ for PowerShell bootstrap too. Start a new Codex task to reload agents after a switch. GPT-6.2 Sol on Codex CLI requires 0.166.0 or later.

## Commands

```bash
# Install or upgrade
npx -y github:shangzhimingge/sol-luna-handoff install

# Read-only health check
npx -y github:shangzhimingge/sol-luna-handoff doctor

# Remove exact managed content
npx -y github:shangzhimingge/sol-luna-handoff uninstall
```

`CODEX_HOME` selects the target Codex directory and defaults to `~/.codex`.

## Safe 1.x migration

Install automatically migrates either exact 1.x managed configuration (`adaptive` or `sol-luna`) to schema 2. Unknown schemas, values, extra fields, malformed content, directories, and customized files fail before mutation.

The retired `terra-executor.toml` agent is removed only when its bytes match a published managed LF or CRLF version. A customized file at that path is preserved and blocks installation before any write. The Skill, five agents, retired-agent removal, global rule, and configuration participate in one rollback transaction; injected or real failures restore the previous state. Reinstalling an already current installation performs no writes and preserves mtimes.

Historical 1.x design documents remain in `docs/superpowers` for provenance. [`2026-10-08-pure-sol-luna-design.md`](docs/superpowers/specs/2026-10-08-pure-sol-luna-design.md) supersedes their active routing and installation decisions.

## Development

```bash
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File ./test/install-agents.tests.ps1
```

## License

MIT
