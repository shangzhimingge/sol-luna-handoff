---
name: sol-luna-handoff
description: Use when handling any task that creates, modifies, fixes, refactors, reviews, tests, configures, or documents software or project artifacts.
---

# Sol-Luna Workflow

Select the least costly Sol-Luna route that satisfies the task's scope and risk, then advance automatically without pausing for routine confirmation.

## Preflight

1. Read `$CODEX_HOME/sol-luna-handoff.json`, where `CODEX_HOME` defaults to `~/.codex`. The only current document is schema version `2` with `workflow` equal to `sol-luna`. A missing document selects this sole workflow. An exact schema-version-1 managed document requires running the installer to migrate it. For malformed, customized, or unsupported content, return `NEEDS_CONTEXT` with the exact configuration problem before routing.
2. Check whether `sol_planner`, `sol_compact_planner`, `luna_scout`, `luna_executor`, and `luna_fast_executor` are selectable.
3. If any are absent or the configuration requires migration, run `scripts/install-agents.ps1` from this Skill directory. Newly installed agents may require a fresh task to become selectable; until then, use the fallback contracts below.
4. Preserve the parent task's sandbox and approval settings.

## Deterministic routing

Follow this state machine in order. Scout is the only delegation allowed before the final route is emitted.

### State 1 - classify Tier

Classify in this exact order: Tier 3, Tier 1, then Tier 2.

| Tier | Exact predicate |
| --- | --- |
| **Tier 3** | Select if **any** Tier 3 predicate below is true. |
| **Tier 1** | Select only if **all** are true: at most 2 expected changed files; at most 100 expected changed lines; exactly 1 subsystem; an explicit acceptance condition; and no Tier 3 predicate. Unknown file, line, subsystem, or acceptance bounds fail this Tier 1 test. |
| **Tier 2** | Default to Tier 2 when Tier 3 is false and any Tier 1 condition is false. This includes bounded work of 3 to 8 files and bounded cross-component integration. |

Tier 3 predicates are: more than 8 expected changed files; security; authentication; authorization or permissions; cryptography; data migration; a destructive operation; deployment; a public API; concurrency; a dependency migration; architecture or an architectural decision; ambiguous requirements or scope that cannot be bounded before editing; or an explicit user request for full verification.

Do not infer low risk from missing information. Resolve it with the conditional Scout when applicable; otherwise the ambiguity predicate selects Tier 3.

### State 2 - decide and run Scout

Tier 1 always records `Scout: no` and skips Scout. For Tier 2 and Tier 3 only, apply the Conditional Scout triggers below. When Scout is required, dispatch `luna_scout` and wait for its compressed evidence. Otherwise record that Scout was skipped. Do not emit the final route line before Scout has completed or been skipped.

### State 3 - decide Planner

Use the task brief plus completed Scout evidence when present. Tier 1 selects `none`. Tier 2 selects `compact` only when a planning trigger below applies and otherwise selects `none`. Tier 3 always selects `full`.

### State 4 - decide Executor

Every tier selects Luna. Tier 1 uses `luna_fast_executor`; Tier 2 and Tier 3 use `luna_executor`.

### State 5 - emit the final route

Emit exactly one final route line immediately before Planner or Executor delegation:

`Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna`

After emitting the line, delegate the selected Planner when it is `compact` or `full`, then delegate the selected Executor. Treat the emitted line as the unique final routing decision for that routing pass; only a tier upgrade starts a new pass.

## Conditional Scout for Tier 2 and Tier 3

Use `luna_scout` when any one of these discovery conditions is true:

- relevant files or key symbols are not located and the search must cross more than one subsystem;
- diagnostic logs, traces, or error material contain more than 500 lines;
- the modules crossed by the call chain are unclear;
- a planner would otherwise need a broad repository search.

Skip Scout when the exact files, symbols, constraints, and acceptance criteria are known. The Scout is read-only and returns at most **250 output tokens** containing only candidate paths and symbols, the shortest call chain, key evidence, and remaining unknowns. Store raw search and log output in a task-local file and pass only its path plus the compressed report.

## Tier behavior

### Tier 1: direct Luna

Set `Scout: no; Planner: none; Executor: luna`. Dispatch `luna_fast_executor` with task-local instructions, relevant paths, the acceptance condition, and focused checks. It implements, runs the checks, inspects the diff, and self-verifies. Skip Sol and Scout.

### Tier 2: conditional planning and Luna execution

Run `luna_scout` only when a Conditional Scout trigger applies. Run `sol_compact_planner` only when at least one planning trigger applies:

- after Scout, the root cause still requires a choice among multiple candidate approaches;
- the change crosses multiple subsystems with ordering or dependency relationships;
- compatibility constraints or a new cross-file invariant exist;
- the acceptance criteria permit multiple implementations with material tradeoffs.

The compact plan must fit within **400 output tokens** and contain only scope and non-goals, ordered steps, affected files, checks, and acceptance criteria. If no planning trigger applies, the coordinator creates an explicit task brief and records `Planner: none`.

Dispatch `luna_executor` with the task brief or binding plan. Luna resolves ordinary implementation details and locally diagnosable failures inside the bounded scope. Multi-file work, business logic, and ordinary local debugging remain in scope when the strategy is explicit and the result is independently verifiable. Luna does not invent shared-interface semantics, broaden scope, or pursue a non-local unknown failure. If a binding decision is missing or required scope exceeds the brief or plan, Luna stops before further edits and returns `UPGRADE_NEEDED` with preserved evidence for compact Sol replanning or tier reclassification.

Invoke `sol_planner` with high reasoning for verification only when at least one evidence trigger occurs:

- a fresh required check fails;
- discovered scope expands beyond the task brief or plan;
- the executor reports a remaining concern;
- acceptance evidence is incomplete;
- the resulting diff diverges from the task brief or plan.

With no evidence trigger, Luna's fresh checks, diff inspection, and self-review complete the route.

### Tier 3: Sol-Luna-Sol

Run `luna_scout` first only when a Conditional Scout trigger applies. Dispatch `sol_planner` with high reasoning to produce the root cause or architecture, constraints, ordered plan, checks, and acceptance criteria. Then dispatch `luna_executor` with that binding plan. Finally, send the plan, acceptance criteria, executor report, diff summary, and fresh evidence to the same `sol_planner` for mandatory high-reasoning verification.

The verifier returns `VERIFIED` or a bounded numbered findings list naming the failed criterion, evidence, and required correction.

## Shared controls

- Keep exactly one active main executor at a time. Luna implementation reports fit within **300 output tokens**, excluding raw command output stored in task-local files. Each report contains changed files, a concise summary, commands and exit status, self-review, and remaining concerns or `NONE`.
- Exchange Scout, plan, and execution evidence through task-local files. Pass only relevant paths and compressed summaries between agents.
- Sol reads compressed evidence and necessary files; it does not perform broad repository traversal, raw-log screening, routine coding, or ordinary test-failure repair loops.
- If scope or risk crosses a higher-tier predicate, stop and upgrade before further edits. Never downgrade after editing starts.
- Send ordinary implementation corrections to the same active executor. After 2 correction rounds under one task brief or plan, replan before any further correction and reset the count only after the new plan is accepted:
  - for Tier 2 work with `Planner: none`, invoke `sol_compact_planner` and use its output as the new binding plan;
  - for work already governed by a compact or full plan, return to the applicable Sol planner;
  - for Tier 1, return `UPGRADE_NEEDED`, reclassify as at least Tier 2, and invoke `sol_compact_planner` before further correction.
- `NEEDS_CONTEXT` names the exact missing facts. `UPGRADE_NEEDED` is returned before further editing when the current route is insufficient.
- Claim completion only from fresh evidence satisfying every acceptance criterion.

## Fallback dispatch contracts

When a named custom agent is unavailable, dispatch a fresh agent with the matching configuration and contract:

- `sol_planner`: `gpt-6.1-sol`, high reasoning, read-only; full planning or verification contract.
- `sol_compact_planner`: `gpt-6.1-sol`, medium reasoning, read-only; the 400-token compact-plan contract.
- `luna_scout`: `gpt-6-luna`, low reasoning, read-only; the 250-token discovery-evidence contract.
- `luna_executor`: `gpt-6-luna`, medium reasoning, workspace-write; Tier 2 and Tier 3 implementation with a stop-before-expansion contract and a 300-token report.
- `luna_fast_executor`: `gpt-6-luna`, low reasoning, workspace-write; Tier 1 direct execution and self-verification with a 300-token report.

Reuse the same main executor for correction rounds and preserve the selected tier's Scout, planning, execution, and verification rules.
