# Optional Sol → Luna Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `sol-luna` execution profile that keeps the adaptive profile as default, routes Tier 2 and Tier 3 execution to Luna, mirrors the release into `codex-workflow-skills`, enables the profile locally, and pushes both repositories.

**Architecture:** The standalone CLI and PowerShell installer own `$CODEX_HOME/sol-luna-handoff.json` as versioned transactional state. `SKILL.md` reads that state during preflight and branches only at executor selection; classification, Scout, Sol planning, correction, and verification contracts stay shared. The workflow pack byte-mirrors the canonical Skill and regenerates its composite assets and routing tail.

**Tech Stack:** Node.js ESM and `node:test`, PowerShell, Markdown Skill contracts, Python `unittest`, Git.

## Global Constraints

- Profiles are exactly `adaptive` and `sol-luna`; omitted configuration means `adaptive`.
- Persist exactly `{ "schemaVersion": 1, "executionProfile": "<profile>" }` with a trailing newline.
- `sol-luna` routes Tier 1 to `luna_fast_executor`, Tier 2 and Tier 3 to `luna_executor`, and preserves full Sol planning plus mandatory Sol verification for Tier 3.
- Keep all six Agent definitions installed; do not change tier thresholds, Scout triggers, correction limits, or token budgets.
- Standalone version becomes `1.5.0`; workflow-pack version becomes `1.3.0`.
- Every mutation is preflighted, atomic, idempotent, rollback-safe, and conservative around customized state.

---

### Task 1: CLI profile parsing and managed configuration

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `bin/cli.mjs`

**Interfaces:**
- Consumes: `process.argv`, `CODEX_HOME`, existing `resolvePaths()`, snapshot, and rollback helpers.
- Produces: `parseArguments(argv) -> { command, requestedProfile }`; `profileConfig(profile) -> string`; `paths.profileConfigPath`; install plan field `profile`.

- [ ] **Step 1: Add failing argument and persistence tests**

Add cases asserting default install writes `adaptive`, `install --profile sol-luna` writes:

```js
assert.deepEqual(JSON.parse(readFileSync(path.join(codexHome, 'sol-luna-handoff.json'), 'utf8')), {
  schemaVersion: 1,
  executionProfile: 'sol-luna',
});
```

Also assert unknown, missing, duplicate, and `uninstall --profile sol-luna` arguments exit nonzero before changing the Codex home.

- [ ] **Step 2: Verify RED**

Run: `node --test --test-name-pattern="profile|argument" test/cli.test.mjs`

Expected: FAIL because `--profile` is currently rejected and no configuration file exists.

- [ ] **Step 3: Implement minimal parsing and install state**

Accept `--profile <adaptive|sol-luna>` for `install` and `doctor`, default install to `adaptive`, add the config path to `resolvePaths()`, preflight recognized JSON only, and include the file in the existing transaction snapshots, writes, verification, and rollback sequence. Serialize with `JSON.stringify(value, null, 2) + '\n'`.

- [ ] **Step 4: Verify GREEN and idempotency**

Run: `node --test --test-name-pattern="profile|argument|idempotent|rolls" test/cli.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit**

```powershell
git add bin/cli.mjs test/cli.test.mjs
git commit -m "feat: persist optional execution profile"
```

### Task 2: Doctor, switching, uninstall, and PowerShell parity

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `test/package-e2e.test.mjs`
- Modify: `skill/sol-luna-handoff/scripts/install-agents.ps1`
- Modify: `bin/cli.mjs`

**Interfaces:**
- Consumes: Task 1 profile configuration.
- Produces: `doctor --profile <profile>` match check; atomic profile switching; exact managed-config uninstall; PowerShell `param([ValidateSet('adaptive','sol-luna')] [string]$Profile = 'adaptive')`.

- [ ] **Step 1: Add failing lifecycle tests**

Cover adaptive → sol-luna → adaptive switching, `doctor` auto-detection, requested-profile mismatch, exact uninstall, customized-config rejection, rollback after injected post-write failure, and packed CLI install/doctor/uninstall with `--profile sol-luna`. Add PowerShell contract assertions for `ValidateSet`, the config filename, both profile literals, and atomic replacement.

- [ ] **Step 2: Verify RED**

Run: `node --test test/cli.test.mjs test/package-e2e.test.mjs`

Expected: new lifecycle cases FAIL while existing cases remain green.

- [ ] **Step 3: Implement lifecycle behavior**

Make a recognized exact config switchable, make unknown content abort during planning, have `doctor` read the installed profile when no profile is requested, and remove only exact recognized config during uninstall. Mirror these semantics in `install-agents.ps1 -Profile` without weakening existing agent/global-rule conflict checks.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:unit && npm run test:package`

Expected: PASS, including rollback and package E2E.

- [ ] **Step 5: Commit**

```powershell
git add bin/cli.mjs skill/sol-luna-handoff/scripts/install-agents.ps1 test/cli.test.mjs test/package-e2e.test.mjs
git commit -m "feat: support profile lifecycle across installers"
```

### Task 3: Profile-aware routing contract and release documentation

**Files:**
- Modify: `test/routing-contract.test.mjs`
- Modify: `skill/sol-luna-handoff/SKILL.md`
- Modify: `skill/sol-luna-handoff/assets/luna-executor.toml`
- Modify: `skill/sol-luna-handoff/agents/openai.yaml`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `$CODEX_HOME/sol-luna-handoff.json` schema from Task 1.
- Produces: exact route line `Route: Tier N - {reason}; Profile: adaptive|sol-luna; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra` and a Luna executor brief containing the active profile.

- [ ] **Step 1: Add failing routing contract tests**

Assert the Skill documents config lookup/defaulting, preserves every adaptive invariant, makes `sol-luna` Tier 2/3 executor Luna, retains Tier 3 full planning/verification, and contains no reachable Terra handoff in that profile. Assert metadata and both READMEs document `--profile sol-luna`, and package version equals `1.5.0`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:contracts`

Expected: FAIL on missing profile semantics and version.

- [ ] **Step 3: Implement shared classification with profile-specific executor selection**

Add configuration lookup to Preflight, carry the profile through route emission and executor briefs, keep the adaptive sections intact, and add a closed `sol-luna` branch. Update Luna's prompt so Terra exceptions request needed Sol planning/verification rather than a Terra switch only when the supplied profile is `sol-luna`. Update interface copy, bilingual usage, safety behavior, migration notes, and version metadata.

- [ ] **Step 4: Verify GREEN and full standalone suite**

Run: `npm test`

Expected: all unit, contract, and package tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add skill README.md README.zh-CN.md package.json test
git commit -m "feat: add Sol-Luna execution profile"
```

### Task 4: Mirror the canonical Skill into the workflow pack

**Files:**
- Replace: `../codex-workflow-skills/skills/sol-luna-handoff/**`
- Modify: `../codex-workflow-skills/skills/quota-aware-runner/SKILL.md`
- Regenerate: `../codex-workflow-skills/skills/quota-aware-runner/assets/**`
- Modify: `../codex-workflow-skills/docs/upstream-provenance.json`
- Modify: `../codex-workflow-skills/docs/design.md`
- Modify: `../codex-workflow-skills/README.md`
- Modify: `../codex-workflow-skills/README.en.md`
- Modify: `../codex-workflow-skills/package.json`
- Modify: `../codex-workflow-skills/tests/test_sol_luna_contract.py`
- Modify: `../codex-workflow-skills/tests/install-agents.tests.ps1`
- Modify: `../codex-workflow-skills/tests/skills-cli-smoke.mjs`

**Interfaces:**
- Consumes: committed standalone `skill/sol-luna-handoff` tree and its Git commit.
- Produces: byte-identical canonical mirror; composite routing tail with identical profile semantics; provenance `skillVersion: 1.5.0`, new commit, and recomputed deterministic tree digest.

- [ ] **Step 1: Add failing pack assertions**

Require both profiles, Tier 2/3 Luna semantics, route profile field, PowerShell profile parity, package version `1.3.0`, and updated provenance. Run `python -m unittest tests.test_sol_luna_contract -v`; expect FAIL.

- [ ] **Step 2: Copy the canonical tree and update composite/docs metadata**

Copy `skill/sol-luna-handoff` to `../codex-workflow-skills/skills/sol-luna-handoff`, adapt only pack-owned paths already allowed by provenance policy, update `quota-aware-runner/SKILL.md` while preserving its auto-resume prefix, then run `python tools/sync-composite.py` from the pack repository. Compute the tree digest with the same algorithm used by `tests/test_sol_luna_contract.py` and record the standalone HEAD commit.

- [ ] **Step 3: Verify GREEN**

Run from `../codex-workflow-skills`:

```powershell
npm test
npm run test:cli
pwsh -NoProfile -File tests/install-agents.tests.ps1
pwsh -NoProfile -File tests/composite-install.tests.ps1
```

Expected: synchronization check and every Python, Node, and PowerShell test PASS.

- [ ] **Step 4: Commit**

```powershell
git add skills docs tests tools README.md README.en.md package.json
git commit -m "feat: sync optional Sol-Luna profile"
```

### Task 5: Independent verification and local activation

**Files:**
- Update managed installation: `$CODEX_HOME/skills/sol-luna-handoff/**`
- Create/update managed configuration: `$CODEX_HOME/sol-luna-handoff.json`
- Preserve/update managed agents and `$CODEX_HOME/AGENTS.md` through the installer only.

**Interfaces:**
- Consumes: verified standalone CLI and committed canonical Skill.
- Produces: local `executionProfile: sol-luna` with healthy Skill, agents, and activation rule.

- [ ] **Step 1: Re-run clean repository verification**

Run `npm test` in `sol-luna-handoff`, then all four Task 4 commands in `codex-workflow-skills`; expect exit code 0 for every command.

- [ ] **Step 2: Install locally with the selected profile**

Run from `sol-luna-handoff`:

```powershell
node bin/cli.mjs install --profile sol-luna
node bin/cli.mjs doctor --profile sol-luna
```

Expected: install succeeds and doctor reports a healthy `sol-luna` installation. Compare the local Skill tree to `skill/sol-luna-handoff` by relative path and SHA-256; expect no differences.

- [ ] **Step 3: Inspect diffs and provenance**

Run `git status --short`, `git diff HEAD~3..HEAD --check`, and focused searches for stale `1.4.0`, `1.2.0`, or adaptive-only route text. Confirm only intended historical references remain.

### Task 6: Push both repositories and verify remote heads

**Files:** None.

**Interfaces:**
- Consumes: clean verified `main` branches.
- Produces: `origin/main` at each local HEAD.

- [ ] **Step 1: Push the canonical repository first**

Run: `git push origin main` in `sol-luna-handoff`; expect success.

- [ ] **Step 2: Reconfirm and, if required, update the pack provenance commit before its final verification**

Run: `git rev-parse HEAD` in the canonical repository and compare it with `docs/upstream-provenance.json` in the pack. If Task 5 added no canonical commit, values already match. Re-run pack tests after any provenance-only correction and commit it atomically.

- [ ] **Step 3: Push the workflow pack and verify**

Run `git push origin main` in `codex-workflow-skills`, followed by `git ls-remote origin refs/heads/main` for both repositories. Expected: each remote hash equals its local `git rev-parse HEAD`.
