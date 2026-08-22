---
name: sol-luna-handoff
description: Use when handling any task that creates, modifies, fixes, refactors, reviews, tests, configures, or documents software or project artifacts.
---

# Sol-Luna Handoff

Route demanding work through Sol planning, Luna execution, and Sol verification. Advance automatically after each successful stage; do not pause for routine confirmation.

## Preflight

1. Check whether the `sol_planner` and `luna_executor` custom agents are selectable.
2. If either is absent, run `scripts/install-agents.ps1` from this skill directory. Note that discovery of newly installed custom agents may require a fresh task, then continue with the fallback dispatch contract below.
3. Preserve the parent task's sandbox and approval settings.

## Orchestration

### 1. Plan with Sol

Dispatch `sol_planner`. Require a usable plan with this fixed contract:

- scope and explicit non-goals
- ordered implementation steps
- exact constraints and relevant repository instructions
- affected files
- verification commands
- testable acceptance criteria

If essential context is missing, require `NEEDS_CONTEXT` with the exact missing facts. Resolve those facts before execution; do not let the executor infer or broaden scope.

### 2. Execute with Luna

After receiving a usable plan, automatically dispatch `luna_executor` with the request, repository context, and complete plan as a binding execution contract. Require Luna to make only in-scope changes, run every specified check, inspect the diff, and return:

- changed files and a concise change summary
- every verification command, exit status, and essential output
- self-review results
- remaining concerns, or `NONE`

Treat `NEEDS_CONTEXT` as a request for Sol to amend the contract. Do not pause for routine user confirmation between stages.

### 3. Verify with Sol

Automatically send the plan, acceptance criteria, Luna report, diff summary, and fresh check evidence to `sol_planner` in verification mode. Require Sol to compare the evidence against every acceptance criterion and return exactly one of:

- `VERIFIED`
- a bounded numbered findings list, with the failed criterion, evidence, and required correction for each finding

On findings, send the list back to the same Luna executor. Require focused corrections, rerun all affected checks, refresh the implementation report, and return it to Sol. Repeat until Sol returns `VERIFIED`.

Claim completion only after fresh verification evidence supports every acceptance criterion. Report changed files, checks, and any remaining concerns concisely.

## Fallback Dispatch Contract

When named custom-agent selection is unavailable, dispatch a fresh planning/verifying agent explicitly using `gpt-5.6-sol` with `high` reasoning and the `sol_planner` contract. Dispatch a fresh executor explicitly using `gpt-5.6-luna` with `medium` reasoning and the `luna_executor` contract. Keep the same executor for correction rounds and preserve the automatic Sol-to-Luna-to-Sol sequence.
