# Sol → Terra/Luna Handoff

> **Cost-aware adaptive multi-agent routing for Codex.**
>
> Sol plans and verifies high-risk work, Terra handles substantial implementation, and Luna performs fast discovery or explicit mechanical work.

[简体中文](./README.zh-CN.md)

![Version](https://img.shields.io/badge/version-v1.3.0-2563eb)
![License](https://img.shields.io/badge/license-MIT-16a34a)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933)
![Codex](https://img.shields.io/badge/Codex-Agent%20Skill-111827)

## Install everything with one command

```bash
npx -y github:shangzhimingge/sol-luna-handoff
```

That single command installs or safely upgrades:

```text
~/.codex/skills/sol-luna-handoff/   Skill
~/.codex/agents/*.toml              6 custom agents
~/.codex/AGENTS.md                  managed automatic-activation rule
```

After setup, use Codex normally. Supported project-artifact tasks activate the Skill through the managed global rule; there is no first-use setup command.

If Codex was already open and cached agent discovery, start a new Codex task or restart the app once.

### Check or remove the installation

```bash
# Read-only health check
npx -y github:shangzhimingge/sol-luna-handoff doctor

# Safe uninstall
npx -y github:shangzhimingge/sol-luna-handoff uninstall
```

To install a specific release instead of the current default branch:

```bash
npx -y github:shangzhimingge/sol-luna-handoff#v1.3.0
```

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
Luna or Terra executes
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
| **Tier 2 — Balanced** | Tier 3 is false, but at least one Tier 1 condition is false | Conditional Scout → optional compact Sol → Luna or Terra → conditional Sol verification |
| **Tier 3 — Full** | Large, architectural, destructive, security-sensitive, deployment-related, public-API, or unbounded work | Conditional Scout → Sol → Terra → Sol |

Unknown bounds do not qualify a task for Tier 1. Unbounded uncertainty escalates instead of being treated as low risk.

Immediately before planning or execution, the Skill emits one route line:

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra
```

## Six purpose-built agents

| Agent | Model / reasoning | Access | Responsibility |
| --- | --- | --- | --- |
| `luna_scout` | Luna / low | read-only | Repository discovery, long-log compression, call-chain evidence |
| `sol_compact_planner` | Sol / medium | read-only | Bounded Tier 2 planning |
| `sol_planner` | Sol / high | read-only | Full planning and high-reasoning verification |
| `terra_executor` | Terra / medium | workspace-write | Multi-file logic, integration, refactoring, debugging |
| `luna_executor` | Luna / medium | workspace-write | Explicit mechanical, config, test, and docs work |
| `luna_fast_executor` | Luna / low | workspace-write | Tier 1 direct implementation and self-verification |

Discovery and executor reports are bounded. Raw diagnostics stay in task-local files rather than being copied repeatedly between agents.

## Conditional discovery, planning, and verification

### Scout

Tier 1 is always Scout-free. Tier 2 and Tier 3 use `luna_scout` only when broad discovery would consume expensive context, such as an unclear cross-module call chain or diagnostics longer than 500 lines.

### Sol planning in Tier 2

Tier 2 skips Sol when the implementation brief is already explicit. Compact Sol planning is added for real tradeoffs, unresolved root causes, compatibility constraints, dependency ordering, or new cross-file invariants.

### Luna vs Terra

Luna receives local, explicit, repetitive, configuration, test, or documentation work. Terra receives multi-file business logic, integration, refactoring, ordinary debugging, and implementation that still requires broader reasoning.

### Verification

Tier 2 adds Sol verification only when fresh evidence shows value: a failed required check, scope expansion, incomplete acceptance evidence, a remaining executor concern, or a diff that diverges from the brief. Tier 3 always ends with Sol verification.

## Installer behavior

The v1.3 installer is a dependency-free Node.js CLI. It uses `CODEX_HOME` when set and otherwise targets `~/.codex`.

### Safety properties

- Preflights the Skill, all six agents, and global markers before the first mutation.
- Keeps exact current files unchanged, including timestamps.
- Migrates exact bundled v1.0, v1.1, and v1.2 Skill trees.
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
& (Join-Path $SkillTarget "scripts\install-agents.ps1")
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
├── bin/
│   └── cli.mjs
├── package.json
├── README.md
├── README.zh-CN.md
├── LICENSE
├── test/
│   └── cli.test.mjs
└── skill/
    └── sol-luna-handoff/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── assets/
        │   ├── global-agents.md
        │   └── *.toml
        ├── scripts/install-agents.ps1
        └── tests/install-agents.tests.ps1
```

## Requirements and limitations

- Node.js 18 or newer for the npx installer.
- Git for the GitHub package spec used by npx.
- Codex with Skills and custom-agent support.
- Actual model and agent availability depends on the active Codex plan and environment.
- Routing improves allocation rather than promising the same cost, latency, or quality result for every workload.

## Development

```bash
npm test
npm pack --dry-run
```

The existing PowerShell regression suite can be run separately:

```powershell
& ".\skill\sol-luna-handoff\tests\install-agents.tests.ps1"
```

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
