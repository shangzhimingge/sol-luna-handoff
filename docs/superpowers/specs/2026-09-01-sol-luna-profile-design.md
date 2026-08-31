# Sol → Luna Execution Profile Design

## Goal

Add an opt-in `sol-luna` execution profile while preserving the current adaptive Sol/Terra/Luna workflow as the default. The profile must work for automatic Skill activation, standalone installation, the `codex-workflow-skills` mirror and composite Skill, and an existing local Codex installation.

## User interface

The standalone CLI accepts:

```text
sol-luna-handoff install --profile adaptive
sol-luna-handoff install --profile sol-luna
sol-luna-handoff doctor --profile sol-luna
```

Skills-based installations expose the equivalent PowerShell entry point:

```powershell
./scripts/install-agents.ps1 -Profile sol-luna
```

`adaptive` remains the default when `--profile` is omitted. Unknown profiles, duplicate profile arguments, or profile arguments on unsupported commands fail before mutation and print actionable usage information.

Installation persists the selected profile in `$CODEX_HOME/sol-luna-handoff.json`. The file has one versioned, installer-owned document:

```json
{
  "schemaVersion": 1,
  "executionProfile": "sol-luna"
}
```

The installer writes the configuration atomically with the Skill, agents, and global activation rule. Reinstallation with the same profile is idempotent. Switching profiles updates only recognized managed state. Unknown or customized configuration aborts before any target changes. Rollback restores the pre-run configuration exactly. Uninstall removes only an exact managed configuration and otherwise stops without mutation.

`doctor` without `--profile` validates the installed profile recorded in the configuration. With `--profile`, it additionally requires the installed profile to match the requested value.

## Routing semantics

Every routing pass reads the persisted execution profile during preflight. A missing configuration is treated as `adaptive` for compatibility with Skills installed through generic Skill tooling.

### Adaptive profile

The existing Tier 1, Tier 2, Tier 3, Scout, Sol planning, Terra exception, Luna-to-Terra handoff, correction, and verification contracts remain unchanged.

### Sol-Luna profile

- Tier classification and Conditional Scout rules remain unchanged.
- Tier 1 uses `luna_fast_executor` with no Planner.
- Tier 2 keeps the existing optional compact Sol planning rules and always uses `luna_executor`.
- Tier 3 uses full `sol_planner`, then `luna_executor`, then mandatory high-reasoning Sol verification.
- The six Terra exceptions become planning and verification evidence rather than executor-switch triggers.
- A Luna executor stops with `UPGRADE_NEEDED` only for a tier increase, missing binding decisions, or scope beyond the current brief or plan. It never requests a Terra handoff in this profile.
- The route line records the active profile using the exact shape `Route: Tier N - {reason}; Profile: adaptive|sol-luna; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra`. A `sol-luna` route always names `Executor: luna`.
- Correction limits, replanning thresholds, evidence preservation, token budgets, and completion gates remain unchanged.

All six agent definitions remain installed so switching back to `adaptive` is atomic and does not require agent discovery to change. `terra_executor` is never selected while `sol-luna` is active.

## Components and synchronization

### `sol-luna-handoff`

- Extend `bin/cli.mjs` argument parsing, transactional planning, health checks, rollback, uninstall, and help output.
- Extend the PowerShell agent installer so a Skills-based installation can select and persist the same profile.
- Update `SKILL.md`, agent prompts where profile awareness is required, interface metadata, English and Chinese README files, and package metadata.
- Add unit, routing-contract, and packed-package coverage for both profiles and profile switching.
- Release metadata moves from `1.4.0` to `1.5.0` because the change is backward-compatible functionality.

### `codex-workflow-skills`

- Import the standalone Skill byte-for-byte and update the pinned upstream commit, version, and tree digest.
- Regenerate composite assets and keep the composite routing tail semantically identical to the canonical Skill.
- Teach `quota-aware-runner` to honor the same persisted profile while retaining its auto-resume prefix.
- Update tests, bilingual documentation, and package metadata from `1.2.0` to `1.3.0`.

### Local Codex installation

- Replace the local `sol-luna-handoff` Skill with the verified canonical tree.
- Run the updated installer with `--profile sol-luna` against the active `CODEX_HOME`.
- Verify the local configuration, installed Skill tree, managed global rule, and agent definitions.

## Testing and acceptance criteria

1. The default installation remains byte-for-byte compatible in routing behavior and selects `adaptive`.
2. `install --profile sol-luna` persists the profile atomically and is idempotent.
3. Switching between `adaptive` and `sol-luna` preserves unrelated Codex files and passes `doctor`.
4. Invalid or customized profile state causes a pre-mutation failure; injected post-write failures restore every snapshot.
5. In `sol-luna`, every Tier 2 and Tier 3 route selects Luna, Tier 3 retains full Sol planning and mandatory Sol verification, and no Terra handoff path is reachable.
6. Standalone unit, routing-contract, and package tests pass.
7. The workflow pack mirror, provenance, composite synchronization, Python tests, and skills CLI smoke tests pass.
8. The local Skill and configuration match the committed canonical content and report healthy.
9. Both repositories have focused commits on `main` and are pushed to their `origin/main` branches.

## Non-goals

- Removing the Terra agent or adaptive profile.
- Adding arbitrary user-defined routing profiles.
- Changing tier classification thresholds, Scout triggers, correction limits, or token budgets.
- Publishing a GitHub release or tag as part of this change.
