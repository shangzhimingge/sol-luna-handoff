# Pure Sol-Luna Workflow Design

**Status:** Supersedes the active routing and installer decisions in the earlier profile designs. Historical specifications remain for migration provenance.

## Goal

Version 2.0.0 exposes one workflow only: Sol plans and verifies; Luna discovers, implements, and self-checks. The release removes Terra execution and profile selection from every active interface while safely migrating exact managed 1.x installations.

## Routing

- Tier 1: `luna_fast_executor` directly implements and verifies.
- Tier 2: `luna_executor` implements; `sol_compact_planner` runs only under the existing planning triggers; Sol verification remains evidence-triggered.
- Tier 3: `sol_planner` plans, `luna_executor` implements, and `sol_planner` performs mandatory verification.
- The final route line is `Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna`.
- Existing tier thresholds, Scout conditions, correction limits, and output budgets are unchanged.
- When Luna discovers a missing binding decision or scope expansion, it preserves evidence and returns `UPGRADE_NEEDED` for Sol replanning. No executor-family handoff exists.

## Agents and models

The installed set contains exactly five agents: `sol_planner`, `sol_compact_planner`, `luna_scout`, `luna_executor`, and `luna_fast_executor`. Sol agents use `gpt-6.1-sol`; Luna agents use `gpt-6-luna`. Existing reasoning-effort and sandbox assignments remain unchanged.

## Configuration and CLI

The only canonical configuration is:

```json
{
  "schemaVersion": 2,
  "workflow": "sol-luna"
}
```

`install`, `doctor`, and `uninstall` accept no profile option. A missing configuration is a new installation. The two exact v1 documents (`executionProfile` equal to `adaptive` or `sol-luna`) migrate to v2 during install. Extra fields, unknown schema versions, unknown values, malformed JSON, and non-file path collisions fail during preflight before any write. `doctor` reports healthy only for exact v2 managed state.

## Safe Terra retirement

`terra-executor.toml` is obsolete. Install and uninstall remove it only when its bytes match a published managed LF or CRLF hash. A directory, symlink-like unsupported entry, or custom file at that path is a collision and aborts before any mutation. The retired asset is absent from the package.

## Transactions

Planning validates the Skill, all five active agents, the obsolete Terra path, global rules, and configuration before mutation. Apply snapshots every affected file, including obsolete Terra and configuration; failures after legacy-agent removal, after config write, or during later verification restore bytes, metadata, directories, and the prior Skill tree. Idempotent installs perform no writes and preserve mtimes. Uninstall handles exact v1/v2 config and exact managed Terra residue while preserving unrelated content.

## Compatibility and non-goals

This is a breaking 2.0.0 release. Historical specifications stay unchanged and are explicitly superseded by this document. Auto-resume, tier classification, Scout triggers, correction accounting, token budgets, release tags, and publishing are outside this implementation.
