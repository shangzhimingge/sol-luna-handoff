import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

function includesAll(text, expected) {
  for (const value of expected) assert.match(text, value);
}

test('the workflow exposes one Sol-Luna route and no retired execution lane', async () => {
  const [skill, metadata, globalRule] = await Promise.all([
    read('skill/sol-luna-handoff/SKILL.md'),
    read('skill/sol-luna-handoff/agents/openai.yaml'),
    read('skill/sol-luna-handoff/assets/global-agents.md'),
  ]);
  includesAll(skill, [
    /Every tier selects Luna/i,
    /Tier 1 uses `luna_fast_executor`/,
    /Tier 2 and Tier 3 use `luna_executor`/,
    /Route: Tier N - \{reason\}; Scout: yes\|no; Planner: none\|compact\|full; Executor: luna/,
    /Tier 3: Sol-Luna-Sol/,
    /mandatory high-reasoning verification/i,
  ]);
  for (const text of [skill, metadata, globalRule]) {
    assert.doesNotMatch(text, /terra|adaptive|execution profile|executor-family handoff/i);
  }
  assert.equal(existsSync(new URL('../skill/sol-luna-handoff/assets/terra-executor.toml', import.meta.url)), false);
});

test('configuration contract is schema 2 and has one workflow', async () => {
  const [skill, cli, powershell] = await Promise.all([
    read('skill/sol-luna-handoff/SKILL.md'),
    read('bin/cli.mjs'),
    read('skill/sol-luna-handoff/scripts/install-agents.ps1'),
  ]);
  includesAll(skill, [/schema version `2`/i, /`workflow` equal to `sol-luna`/i, /missing document selects this sole workflow/i]);
  includesAll(cli, [/schemaVersion: 2/, /workflow: 'sol-luna'/, /legacyConfigTexts/, /retiredTerraHashes/]);
  includesAll(powershell, [/`"schemaVersion`": 2/, /`"workflow`": `"sol-luna`"/, /retiredTerraHashes/]);
  assert.doesNotMatch(cli, /--profile|requestedProfile|executionProfile: profile/);
  assert.doesNotMatch(powershell, /\[string\]\$Profile|ValidateSet\('adaptive'/);
});

test('agent models and permissions match the 2.0 contract', async () => {
  const expected = [
    ['sol-planner.toml', 'sol_planner', 'gpt-6.1-sol', 'high', 'read-only'],
    ['sol-compact-planner.toml', 'sol_compact_planner', 'gpt-6.1-sol', 'medium', 'read-only'],
    ['luna-scout.toml', 'luna_scout', 'gpt-6-luna', 'low', 'read-only'],
    ['luna-executor.toml', 'luna_executor', 'gpt-6-luna', 'medium', 'workspace-write'],
    ['luna-fast-executor.toml', 'luna_fast_executor', 'gpt-6-luna', 'low', 'workspace-write'],
  ];
  for (const [file, name, model, effort, sandbox] of expected) {
    const text = await read(`skill/sol-luna-handoff/assets/${file}`);
    includesAll(text, [
      new RegExp(`name = "${name}"`),
      new RegExp(`model = "${model.replace('.', '\\.')}"`),
      new RegExp(`model_reasoning_effort = "${effort}"`),
      new RegExp(`sandbox_mode = "${sandbox}"`),
    ]);
  }
});

test('tier thresholds, Scout triggers, correction limit, and budgets remain explicit', async () => {
  const skill = await read('skill/sol-luna-handoff/SKILL.md');
  includesAll(skill, [
    /at most 2 expected changed files/,
    /at most 100 expected changed lines/,
    /more than 8 expected changed files/,
    /diagnostic logs, traces, or error material contain more than 500 lines/,
    /250 output tokens/,
    /400 output tokens/,
    /300 output tokens/,
    /After 2 correction rounds/,
  ]);
});

test('Luna stops for missing binding decisions and preserves evidence for Sol', async () => {
  const [skill, executor] = await Promise.all([
    read('skill/sol-luna-handoff/SKILL.md'),
    read('skill/sol-luna-handoff/assets/luna-executor.toml'),
  ]);
  includesAll(skill, [/binding decision is missing/i, /stops before further edits/i, /UPGRADE_NEEDED/, /Sol replanning/i]);
  includesAll(executor, [/binding decision is missing/i, /stop before further edits/i, /UPGRADE_NEEDED/, /evidence/, /check evidence/]);
});
