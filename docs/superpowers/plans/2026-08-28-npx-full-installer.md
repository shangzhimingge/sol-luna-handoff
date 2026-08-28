# npx full installer implementation plan

**Goal:** Ship a dependency-free Node CLI that fully installs, diagnoses, and removes the Sol–Luna Codex integration from one npx invocation.

**Architecture:** Keep the existing Skill and PowerShell setup path intact. Add a repository-level executable package that treats the Skill tree and assets as immutable bundled inputs, computes a complete preflight plan, then applies or rolls back mutations. Use Node standard-library modules only.

**Tech stack:** Node.js 18+ ESM, `node:test`, npm packaging, existing PowerShell regression suite.

## Task 1: Define the CLI contract with failing tests

**Files:**
- Create: `test/cli.test.mjs`
- Create: `package.json`

1. Add test helpers for isolated `CODEX_HOME` directories and CLI subprocesses.
2. Specify first install, default command, idempotence, doctor, collision zero-mutation, marker validation, uninstall, help, and unknown-command behavior.
3. Run `node --test test/cli.test.mjs` and confirm failure because the binary is absent.

## Task 2: Implement package and installer core

**Files:**
- Create: `bin/cli.mjs`
- Modify: `package.json`

1. Add argument parsing and Codex-home resolution.
2. Add byte comparison, normalized tree manifests, marker parsing, and historical-agent migration checks.
3. Implement complete preflight plans for install and uninstall.
4. Implement staged writes, rollback, final verification, and concise output.
5. Run the Node tests until green.

## Task 3: Preserve existing installer compatibility

**Files:**
- Modify only if a regression requires it: `skill/sol-luna-handoff/scripts/install-agents.ps1`

1. Run the existing PowerShell installer suite.
2. Confirm the Node installer and PowerShell fallback install identical agent bytes and managed rules.

## Task 4: Publish bilingual usage documentation

**Files:**
- Modify: `README.md`
- Create: `README.zh-CN.md`

1. Put the one-line npx installation first in both languages.
2. Document install, doctor, uninstall, Codex refresh behavior, permissions, and the PowerShell fallback.
3. Update repository layout and version references to v1.3.0.

## Task 5: Package and end-to-end verification

1. Run `npm test` and the PowerShell regression suite.
2. Run `npm pack --dry-run` and inspect included files.
3. Produce a tarball and execute install, doctor, idempotent reinstall, and uninstall against an isolated Codex home.
4. Review the diff for unrelated changes and public-contract inconsistencies.

## Task 6: Release

1. Commit atomic increments on the feature branch.
2. Merge into `main` after fresh verification.
3. Tag v1.3.0, push the branch and tag, and publish GitHub release notes.
4. Verify the GitHub-backed npx command in a fresh isolated Codex home.
