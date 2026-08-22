---
name: sol-luna-handoff
description: Use when handling any task that creates, modifies, fixes, refactors, reviews, tests, configures, or documents software or project artifacts.
---

# Sol-Luna Handoff

Select the least costly route that satisfies the task's scope and risk, then advance automatically without pausing for routine confirmation.

## Preflight

1. Check whether `sol_planner`, `sol_compact_planner`, `luna_executor`, and `luna_fast_executor` are selectable.
2. If any are absent, run `scripts/install-agents.ps1` from this Skill directory. Newly installed agents may require a fresh task to become selectable; until then, use the fallback contracts below.
3. Preserve the parent task's sandbox and approval settings.

## Deterministic routing

Classify before delegation in the order below and state `Route: Tier N - <reason>` in one line.

| Tier | Exact predicate | Route |
| --- | --- | --- |
| **Tier 3** | Select if **any** Tier 3 predicate below is true. | `sol_planner` high plan -> `luna_executor` medium execution -> `sol_planner` high verification. |
| **Tier 1** | Select only if **all** are true: at most 2 expected changed files; at most 100 expected changed lines; exactly 1 subsystem; an explicit acceptance condition; and no Tier 3 predicate. Unknown file, line, subsystem, or acceptance bounds fail this Tier 1 test. | `luna_fast_executor` low direct execution and self-verification. No Sol planning or verification. |
| **Tier 2** | Default to Tier 2 when Tier 3 is false and any Tier 1 condition is false. This includes bounded work of 3 to 8 files and bounded cross-component integration. | `sol_compact_planner` medium plan -> `luna_executor` medium execution; high Sol verification only on an evidence trigger. |

Tier 3 predicates are: more than 8 expected changed files; security; authentication; authorization or permissions; cryptography; data migration; a destructive operation; deployment; a public API; concurrency; a dependency migration; architecture or an architectural decision; ambiguous requirements or scope that cannot be bounded before editing; or an explicit user request for full verification.

Do not infer low risk from missing information. Resolve cheaply when possible; otherwise the ambiguity predicate selects Tier 3.

## Tier behavior

### Tier 1: direct Luna

Dispatch `luna_fast_executor` with the task-local instructions, relevant paths, acceptance condition, and focused checks. Require it to implement, run the checks, inspect the diff, and self-verify. Skip Sol.

### Tier 2: compact Sol, then Luna

Dispatch `sol_compact_planner`. Its plan must fit within **500 output tokens** and contain only scope and non-goals, ordered steps, affected files, checks, and acceptance criteria. Then dispatch `luna_executor` with that plan as a binding contract.

Invoke `sol_planner` with high reasoning for verification if and only if at least one evidence trigger occurs:

- a fresh required check fails;
- discovered scope expands beyond the plan;
- Luna reports a remaining concern;
- acceptance evidence is incomplete; or
- the resulting diff diverges from the plan.

With no trigger, Luna's fresh checks, diff inspection, and self-review complete the route.

### Tier 3: full Sol-Luna-Sol

Dispatch `sol_planner` with high reasoning for a plan containing scope and non-goals, ordered steps, constraints, affected files, verification commands, and acceptance criteria. Dispatch `luna_executor` with the plan as a binding contract. Then send the plan, acceptance criteria, Luna report, diff summary, and fresh evidence to `sol_planner` in verification mode.

The verifier returns `VERIFIED` or a bounded numbered findings list naming the failed criterion, evidence, and required correction.

## Shared controls

- Cap every executor implementation report at **300 output tokens**, excluding command output stored in files. The report contains changed files, concise summary, commands and exit status, self-review, and remaining concerns or `NONE`.
- Prefer task briefs, plans, and raw command output in files. Pass only task-local instructions, relevant paths, acceptance criteria, and fresh evidence between agents.
- If scope or risk crosses a higher-tier predicate, stop and upgrade before further edits. Never downgrade after editing starts.
- Send verifier findings to the same Luna executor. After 2 correction rounds under one plan, return to the applicable Sol planner for replanning before any further correction; reset the counter for the new plan.
- `NEEDS_CONTEXT` must name the exact missing facts. Resolve them before execution rather than letting Luna infer or broaden scope.
- Claim completion only from fresh evidence satisfying every acceptance criterion.

## Fallback dispatch contracts

When a named custom agent is unavailable, dispatch a fresh agent with the matching configuration and contract:

- `sol_planner`: `gpt-5.6-sol`, high reasoning, read-only; full planning or verification contract.
- `sol_compact_planner`: `gpt-5.6-sol`, medium reasoning, read-only; the 500-token compact-plan contract.
- `luna_executor`: `gpt-5.6-luna`, medium reasoning, workspace-write; binding-plan execution contract.
- `luna_fast_executor`: `gpt-5.6-luna`, low reasoning, workspace-write; direct execution and self-verification contract.

Reuse the same Luna executor for correction rounds and preserve the selected tier's verification rules.
