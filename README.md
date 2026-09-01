# Sol → Luna by default

> **Default Codex workflow: Sol plans and verifies; Luna executes.**
>
> The `sol-luna` profile is now the default for every installation and profileless Skill load. Terra routing is available only when `adaptive` is explicitly selected.

[简体中文](./README.zh-CN.md)

![Version](https://img.shields.io/badge/version-v1.6.0-2563eb)
[![CI](https://github.com/shangzhimingge/sol-luna-handoff/actions/workflows/ci.yml/badge.svg)](https://github.com/shangzhimingge/sol-luna-handoff/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-16a34a)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933)
![Codex](https://img.shields.io/badge/Codex-Agent%20Skill-111827)

## Install everything with one command

```bash
npx -y github:shangzhimingge/sol-luna-handoff
```

The command above installs the default `sol-luna` profile: Sol plans and verifies, while Luna performs all Tier 1, Tier 2, and Tier 3 execution.

To enable Terra routing, explicitly select the optional `adaptive` profile:

```bash
npx -y github:shangzhimingge/sol-luna-handoff install --profile adaptive
```

That single command installs or safely upgrades:

```text
~/.codex/skills/sol-luna-handoff/   Skill
~/.codex/agents/*.toml              6 custom agents
~/.codex/AGENTS.md                  managed automatic-activation rule
~/.codex/sol-luna-handoff.json      managed execution profile
```

After setup, use Codex normally. Supported project-artifact tasks activate the Skill through the managed global rule; there is no first-use setup command.

If Codex was already open and cached agent discovery, start a new Codex task or restart the app once.

### Check or remove the installation

```bash
# Read-only health check
npx -y github:shangzhimingge/sol-luna-handoff doctor

# Require the installed profile to match
npx -y github:shangzhimingge/sol-luna-handoff doctor --profile sol-luna

# Safe uninstall
npx -y github:shangzhimingge/sol-luna-handoff uninstall
```

To install a specific release instead of the current default branch:

```bash
npx -y github:shangzhimingge/sol-luna-handoff#v1.6.0
```

## Execution profiles

- `sol-luna` (**default**): Tier 1 uses `luna_fast_executor`; Tier 2 and Tier 3 use `luna_executor`. Tier 3 still runs full Sol planning and mandatory Sol verification. Terra exceptions become planning and verification evidence rather than executor switches.
- `adaptive` (explicit opt-in): Tier 1 uses Luna, Tier 2 is Luna-first with six closed Terra exceptions, and Tier 3 uses Terra between full Sol planning and mandatory Sol verification.

The installer persists exactly one profile in `sol-luna-handoff.json`. Re-running install switches recognized managed state atomically; unknown or customized configuration stops before mutation. Omitting the file is treated as `sol-luna`, so generic Skill installations receive the same default.

## What problem it solves

A fixed high-reasoning workflow is wasteful for small changes and too weak for large risky changes. `sol-luna-handoff` classifies work by scope and risk, then selects the least costly route that remains strong enough to implement and verify it.

```text
Small + explicit
    ↓
Luna executes and self-verifies

Medium + bounded
    ↓
Optional Luna Scout
    ↓
Optional compact Sol plan
    ↓
Luna executes by default; Terra handles six named exceptions
    ↓
Sol verifies only when evidence requires it

Large / risky / ambiguous
    ↓
Optional Luna Scout
    ↓
Full Sol plan
    ↓
Terra implements
    ↓
Mandatory Sol verification
```

The workflow advances automatically after routing and does not pause for routine confirmation between stages.

## Routing at a glance

Classification order is deterministic: **Tier 3 → Tier 1 → Tier 2**.

| Tier | Exact selection rule | Default route |
| --- | --- | --- |
| **Tier 1 — Fast** | ≤2 expected changed files, ≤100 expected changed lines, exactly one subsystem, explicit acceptance criteria, and no Tier 3 risk | Luna direct execution |
| **Tier 2 — Balanced** | Tier 3 is false, but at least one Tier 1 condition is false | Conditional Scout → optional compact Sol → Luna-first execution or a named Terra exception → conditional Sol verification |
| **Tier 3 — Full** | Large, architectural, destructive, security-sensitive, deployment-related, public-API, or unbounded work | Conditional Scout → Sol → Terra → Sol |

Unknown bounds do not qualify a task for Tier 1. Unbounded uncertainty escalates instead of being treated as low risk.

Immediately before planning or execution, the Skill emits one route line:

```text
Route: Tier N - {reason}; Profile: adaptive|sol-luna; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra
```

## Six purpose-built agents

| Agent | Model / reasoning | Access | Responsibility |
| --- | --- | --- | --- |
| `luna_scout` | Luna / low | read-only | Repository discovery, long-log compression, call-chain evidence |
| `sol_compact_planner` | Sol / medium | read-only | Bounded Tier 2 planning |
| `sol_planner` | Sol / high | read-only | Full planning and high-reasoning verification |
| `terra_executor` | Terra / medium | workspace-write | Six Terra exceptions in Tier 2, plus Tier 3 main implementation |
| `luna_executor` | Luna / medium | workspace-write | Default bounded Tier 2 implementation; all Tier 2/3 execution in `sol-luna` |
| `luna_fast_executor` | Luna / low | workspace-write | Tier 1 direct implementation and self-verification |

Discovery and executor reports are bounded. Raw diagnostics stay in task-local files rather than being copied repeatedly between agents.

## Conditional discovery, planning, and verification

### Scout

Tier 1 is always Scout-free. Tier 2 and Tier 3 use `luna_scout` only when broad discovery would consume expensive context, such as an unclear cross-module call chain or diagnostics longer than 500 lines.

### Sol planning in Tier 2

Tier 2 skips Sol when the implementation brief is already explicit. Compact Sol planning is added for real tradeoffs, unresolved root causes, compatibility constraints, dependency ordering, or new cross-file invariants.

### Luna vs Terra

Luna-first routing selects `luna_executor` when the permitted scope is bounded, the implementation strategy is explicit, and the result is independently verifiable through runnable checks or observable evidence. Multi-file work, business logic, and ordinary local debugging do not by themselves select Terra.

Terra is selected directly only for six Terra exceptions: cross-subsystem or cross-file invariant derivation, shared-interface judgment, an ambiguous root cause, integration uncertainty, a major refactor, or an unknown failure requiring non-local diagnosis. If Luna first discovers one, it stops before broadening scope or editing across the boundary and reports `UPGRADE_NEEDED`. The coordinator performs one evidence-preserving Luna → Terra handoff, then reuses the same Terra for the remaining implementation and corrections. Tier 3 discoveries still trigger a tier upgrade rather than this handoff.

Terra is not a fallback for other Tier 2 work. When a Luna condition is not yet established, an applicable compact plan runs before executor selection; missing facts produce `NEEDS_CONTEXT` naming the exact gap; and a boundary that remains unclear before editing follows the existing Tier 3 ambiguity upgrade. The boundary is re-evaluated after context or planning, and only a named exception can select Terra within Tier 2.

### Verification

Tier 2 adds Sol verification only when fresh evidence shows value: a failed required check, scope expansion, incomplete acceptance evidence, a remaining executor concern, or a diff that diverges from the brief. Tier 3 always ends with Sol verification.

## Installer behavior

The v1.5 installer is a dependency-free Node.js CLI. It uses `CODEX_HOME` when set and otherwise targets `~/.codex`.

### Safety properties

- Preflights the Skill, all six agents, and global markers before the first mutation.
- Preflights and atomically persists recognized `adaptive` or `sol-luna` profile state.
- Keeps exact current files unchanged, including timestamps.
- Migrates exact bundled v1.0, v1.1, v1.2, and v1.3.1 Skill trees.
- Migrates only recognized historical agent definitions.
- Stops before writing when an installed Skill or agent contains unknown content.
- Rejects malformed or duplicate global managed-block markers.
- Stages the Skill directory and uses same-directory atomic file replacement.
- Restores the current run's snapshots if a later installation step fails.
- Preserves unrelated content in global `AGENTS.md`.
- Requires no API key and uploads no repository content.

The command changes Codex configuration under `CODEX_HOME`; it does not edit the project repository where the command is launched.

### Custom Codex home

PowerShell:

```powershell
$env:CODEX_HOME = "D:\CodexProfile"
npx -y github:shangzhimingge/sol-luna-handoff
```

Bash / zsh:

```bash
CODEX_HOME="$HOME/codex-profile" \
  npx -y github:shangzhimingge/sol-luna-handoff
```

## Manual PowerShell fallback

<details>
<summary>Show manual installation</summary>

```powershell
git clone https://github.com/shangzhimingge/sol-luna-handoff.git

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillTarget = Join-Path $CodexHome "skills\sol-luna-handoff"

if (Test-Path -LiteralPath $SkillTarget) {
    throw "The Skill target already exists: $SkillTarget"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $SkillTarget) -Force | Out-Null
Copy-Item -LiteralPath ".\sol-luna-handoff\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1") -Profile sol-luna
```

The PowerShell setup script remains idempotent and supports `-WhatIf` for the agent and global-rule portion.

</details>

## Automatic activation

The installer maintains a marker-delimited block in global Codex `AGENTS.md`. It activates `$sol-luna-handoff` for tasks that create, modify, fix, refactor, review, test, configure, or document software and project artifacts.

General Q&A, translation, and prose-only work unrelated to project artifacts remain outside the automatic trigger.

Manual invocation is still available when desired:

```text
Use $sol-luna-handoff to implement this change.
```

## Repository structure

```text
.
├── .github/workflows/ci.yml
├── bin/
│   └── cli.mjs
├── docs/superpowers/specs/
│   └── 2026-08-30-tier2-luna-first-design.md
├── package.json
├── README.md
├── README.zh-CN.md
├── LICENSE
├── test/
│   ├── cli.test.mjs
│   ├── routing-contract.test.mjs
│   ├── package-e2e.test.mjs
│   └── install-agents.tests.ps1
└── skill/
    └── sol-luna-handoff/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── assets/
        │   ├── global-agents.md
        │   └── *.toml
        └── scripts/install-agents.ps1
```

## Requirements and limitations

- Node.js 18 or newer for the npx installer.
- Git for the GitHub package spec used by npx.
- Codex with Skills and custom-agent support.
- Actual model and agent availability depends on the active Codex plan and environment.
- Routing improves allocation rather than promising the same cost, latency, or quality result for every workload.

## Development and release verification

```bash
npm test
npm pack --dry-run
```

`npm test` runs both the CLI regression suite and a packed-tarball E2E. The E2E creates the exact npm archive, checks its runtime file manifest, then installs, diagnoses, reinstalls, and uninstalls it through `npm exec` in an isolated `CODEX_HOME`.

The PowerShell installer regression suite can be run separately on Windows:

```powershell
& ".\test\install-agents.tests.ps1"
```

GitHub Actions repeats the Node and packed-package suites on Node.js 18, 20, and 22 across Windows, Ubuntu, and macOS. The PowerShell suite runs in a separate Windows job.

## Contributing

Issues and pull requests are welcome, especially for:

- routing edge cases;
- false Tier 1 or Tier 3 classifications;
- installer compatibility;
- reproducible latency or usage comparisons;
- additional deployment environments.

For a routing issue, include the task shape, expected route, actual route, relevant evidence, and the reason the route should differ.

## License

MIT © 2026 shangzhimingge

If this workflow is useful in your Codex setup, consider ⭐ starring the repository so more Codex users can discover it.
