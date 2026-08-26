---
name: sol-luna-handoff
description: Use when handling any task that creates, modifies, fixes, refactors, reviews, tests, configures, or documents software or project artifacts.
---

# Sol-Terra/Luna Handoff

Select the least costly route that satisfies the task's scope and risk, then advance automatically without pausing for routine confirmation.

## Preflight

1. Check whether `sol_planner`, `sol_compact_planner`, `luna_scout`, `terra_executor`, `luna_executor`, and `luna_fast_executor` are selectable.
2. If any are absent, run `scripts/install-agents.ps1` from this Skill directory. Newly installed agents may require a fresh task to become selectable; until then, use the fallback contracts below.
3. Preserve the parent task's sandbox and approval settings.

## Deterministic routing

Before delegation, classify in this exact order: Tier 3, Tier 1, then Tier 2. State the complete decision in one line:

`Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra`

| Tier | Exact predicate |
| --- | --- |
| **Tier 3** | Select if **any** Tier 3 predicate below is true. |
| **Tier 1** | Select only if **all** are true: at most 2 expected changed files; at most 100 expected changed lines; exactly 1 subsystem; an explicit acceptance condition; and no Tier 3 predicate. Unknown file, line, subsystem, or acceptance bounds fail this Tier 1 test. |
| **Tier 2** | Default to Tier 2 when Tier 3 is false and any Tier 1 condition is false. This includes bounded work of 3 to 8 files and bounded cross-component integration. |

Tier 3 predicates are: more than 8 expected changed files; security; authentication; authorization or permissions; cryptography; data migration; a destructive operation; deployment; a public API; concurrency; a dependency migration; architecture or an architectural decision; ambiguous requirements or scope that cannot be bounded before editing; or an explicit user request for full verification.

Do not infer low risk from missing information. Resolve it with the conditional Scout when applicable; otherwise the ambiguity predicate selects Tier 3. After classification, decide Scout, Planner, and Executor using the rules below.

## Conditional Scout

Use `luna_scout` when any one of these discovery conditions is true:

- relevant files or key symbols are not located and the search must cross more than one subsystem;
- diagnostic logs, traces, or error material contain more than 500 lines;
- the modules crossed by the call chain are unclear;
- a planner would otherwise need a broad repository search.

Skip Scout when the exact files, symbols, constraints, and acceptance criteria are known. The Scout is read-only and returns at most **250 output tokens** containing only candidate paths and symbols, the shortest call chain, key evidence, and remaining unknowns. Store raw search and log output in a task-local file and pass only its path plus the compressed report.

## Tier behavior

### Tier 1: direct Luna

Set `Scout: no; Planner: none; Executor: luna`. Dispatch `luna_fast_executor` with task-local instructions, relevant paths, the acceptance condition, and focused checks. It implements, runs the checks, inspects the diff, and self-verifies. Skip Sol, Scout, and Terra.

### Tier 2: conditional planning and execution

Run `luna_scout` only when a Conditional Scout trigger applies. Run `sol_compact_planner` only when at least one of these planning triggers applies:

- after Scout, the root cause still requires a choice among multiple candidate approaches;
- the change crosses multiple subsystems with ordering or dependency relationships;
- compatibility constraints or a new cross-file invariant exist;
- the acceptance criteria permit multiple implementations with material tradeoffs.

The compact plan must fit within **400 output tokens** and contain only scope and non-goals, ordered steps, affected files, checks, and acceptance criteria. If no planning trigger applies, the coordinator creates an explicit task brief and records `Planner: none`. **Skip Sol.**

Choose `luna_executor` only when the implementation strategy is completely explicit and the work is local, mechanical, repetitive, configuration, test, or documentation editing that requires no derivation of cross-file invariants and no handling of unknown test failures. Choose `terra_executor` for every other Tier 2 task.

Invoke `sol_planner` with high reasoning for verification only when at least one evidence trigger occurs:

- a fresh required check fails;
- discovered scope expands beyond the task brief or plan;
- the executor reports a remaining concern;
- acceptance evidence is incomplete;
- the resulting diff diverges from the task brief or plan.

With no evidence trigger, the main executor's fresh checks, diff inspection, and self-review complete the route.

### Tier 3: full Sol-Terra-Sol

Run `luna_scout` first only when a Conditional Scout trigger applies. Dispatch `sol_planner` with high reasoning to read the user requirements, compressed Scout evidence when present, and necessary files, then produce the root cause or architecture, constraints, ordered plan, checks, and acceptance criteria.

Use `terra_executor` as the main executor for every Tier 3 task. Only a fully bounded, independently parallel, mechanical leaf task that reduces total context may use **at most one additional Luna worker**. Then send the plan, acceptance criteria, Terra report, diff summary, and fresh evidence to `sol_planner` for mandatory high-reasoning verification.

The verifier returns `VERIFIED` or a bounded numbered findings list naming the failed criterion, evidence, and required correction.

## Shared controls

- Use one main executor per task. Terra and Luna implementation reports each fit within **300 output tokens**, excluding raw command output stored in task-local files. Each report contains changed files, a concise summary, commands and exit status, self-review, and remaining concerns or `NONE`.
- Exchange Scout, plan, and execution evidence through task-local files. Pass only relevant paths and compressed summaries between agents.
- Sol reads compressed evidence and necessary files; it does not perform broad repository traversal, raw-log screening, routine coding, or ordinary test-failure repair loops.
- If scope or risk crosses a higher-tier predicate, stop and upgrade before further edits. Never downgrade after editing starts.
- Send ordinary implementation corrections to the same executor. After 2 correction rounds under one plan, return to the applicable Sol planner for replanning before any further correction, then reset the correction count.
- `NEEDS_CONTEXT` names the exact missing facts. `UPGRADE_NEEDED` is returned before further editing when the current route is insufficient.
- Claim completion only from fresh evidence satisfying every acceptance criterion.

## Fallback dispatch contracts

When a named custom agent is unavailable, dispatch a fresh agent with the matching configuration and contract:

- `sol_planner`: `gpt-5.6-sol`, high reasoning, read-only; full planning or verification contract.
- `sol_compact_planner`: `gpt-5.6-sol`, medium reasoning, read-only; the 400-token compact-plan contract.
- `luna_scout`: `gpt-5.6-luna`, low reasoning, read-only; the 250-token discovery-evidence contract.
- `terra_executor`: `gpt-5.6-terra`, medium reasoning, workspace-write; binding-plan or task-brief execution contract with a 300-token report.
- `luna_executor`: `gpt-5.6-luna`, medium reasoning, workspace-write; mechanical binding-plan or task-brief execution contract with a 300-token report.
- `luna_fast_executor`: `gpt-5.6-luna`, low reasoning, workspace-write; Tier 1 direct execution and self-verification contract with a 300-token report.

Reuse the same main executor for correction rounds and preserve the selected tier's Scout, planning, execution, and verification rules.
