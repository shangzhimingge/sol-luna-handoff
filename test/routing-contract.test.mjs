import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function includesAll(text, expected) {
  for (const value of expected) assert.match(text, value);
}

test("Tier 2 defaults bounded explicit verifiable work to Luna", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /default Tier 2 executor is `luna_executor`/i,
    /bounded/i,
    /implementation strategy is explicit/i,
    /independently verifiable/i,
    /multi-file work, business logic, and ordinary local debugging do not by themselves select Terra/i,
  ]);
});

test("Tier 2 names the complete Terra exception set", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /cross-subsystem or cross-file invariant derivation/i,
    /shared-interface judgment/i,
    /ambiguous root cause/i,
    /integration uncertainty/i,
    /major refactor/i,
    /unknown failure requiring non-local diagnosis/i,
  ]);
});

test("Tier 2 has no catch-all Terra path", async () => {
  const [skill, design, readme, chinese] = await Promise.all([
    read("skill/sol-luna-handoff/SKILL.md"),
    read("docs/superpowers/specs/2026-08-30-tier2-luna-first-design.md"),
    read("README.md"),
    read("README.zh-CN.md"),
  ]);
  for (const text of [skill, design, readme]) {
    assert.doesNotMatch(text, /(?:every|all) other Tier 2[^.]*Terra/i);
    assert.doesNotMatch(text, /otherwise[^.]{0,120}(?:start|select|route)[^.]{0,40}Terra/i);
  }
  assert.doesNotMatch(chinese, /其他[^。]{0,80}Tier 2[^。]{0,80}Terra/i);
  assert.doesNotMatch(chinese, /否则[^。]{0,100}Terra/i);
  includesAll(skill, [
    /Do not use Terra as a fallback/i,
    /return `NEEDS_CONTEXT` naming the exact missing condition/i,
    /apply the compact-planning triggers/i,
    /boundary remains ambiguous before editing.*Tier 3/is,
  ]);
  includesAll(design, [/NEEDS_CONTEXT/, /compact plan/i, /Tier 3 ambiguity/i, /Terra is not a fallback/i]);
  includesAll(readme, [/NEEDS_CONTEXT/, /compact plan/i, /Tier 3 ambiguity/i, /Terra is not a fallback/i]);
  includesAll(chinese, [/NEEDS_CONTEXT/, /compact plan/i, /Tier 3 歧义升级/i, /Terra 不是兜底/]);
});

test("Luna to Terra handoff is single-use and preserves evidence and correction count", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /before expanding scope or making further edits/i,
    /`UPGRADE_NEEDED`/,
    /only one Luna-to-Terra executor switch/i,
    /reuse the same `terra_executor`/i,
    /original task brief or binding plan/i,
    /Luna report/i,
    /current diff/i,
    /check evidence/i,
    /correction count continues across the handoff/i,
    /Tier 3 predicate.*tier upgrade/is,
  ]);
});

test("executor prompts implement the Luna-first boundary", async () => {
  const [luna, terra] = await Promise.all([
    read("skill/sol-luna-handoff/assets/luna-executor.toml"),
    read("skill/sol-luna-handoff/assets/terra-executor.toml"),
  ]);
  includesAll(luna, [
    /default Tier 2 executor/i,
    /UPGRADE_NEEDED/,
    /before expanding scope or making further edits/i,
    /six Terra exceptions/i,
  ]);
  includesAll(terra, [
    /Terra exception/i,
    /Luna report/i,
    /current diff/i,
    /check evidence/i,
    /same executor/i,
  ]);
});

test("release metadata and migration digests describe v1.5.0", async () => {
  const [pkg, readme, chinese, cli, powershell] = await Promise.all([
    read("package.json"), read("README.md"), read("README.zh-CN.md"), read("bin/cli.mjs"),
    read("skill/sol-luna-handoff/scripts/install-agents.ps1"),
  ]);
  assert.equal(JSON.parse(pkg).version, "1.5.0");
  includesAll(readme, [/1\.5\.0/, /v1\.5\.0/, /--profile sol-luna/i, /execution profile/i]);
  includesAll(chinese, [/1\.5\.0/, /v1\.5\.0/, /--profile sol-luna/i, /执行配置/i]);
  includesAll(cli, [
    /023d90536d5974e510910bb18fd11834386b5a8365116aa0218e911d1033f304/i,
  ]);
  const terraHashes = [
    "A347C7596F1794A6B91B8E55A4B6C2B411B282E07288E9A5955C18933D7EAD26",
    "721B9C4A60F66A729B409792FC6BF173678D7F62DEF82B36CA1123CC247515AC",
    "71EAC578F0925EB11C358E2AD1C65A69BD784966A16A798DFBD05A71F97F87D3",
    "49BAA5F4707F6F97117A106BC6380E63CD71D4A5EE79DE4257B9F0742D18C16A",
  ];
  const cliTerraBlock = cli.match(/\['terra-executor\.toml', new Set\(\[([\s\S]*?)\]\)\]/u)?.[1] ?? "";
  const powershellTerraBlock = powershell.match(/'terra-executor\.toml'\s*=\s*@\(([\s\S]*?)\)/u)?.[1] ?? "";
  assert.deepEqual([...cliTerraBlock.matchAll(/'([0-9A-F]{64})'/gu)].map((match) => match[1]), terraHashes);
  assert.deepEqual([...powershellTerraBlock.matchAll(/'([0-9A-F]{64})'/gu)].map((match) => match[1]), terraHashes);
  const skillDigestBlock = cli.match(/knownLegacySkillDigests = new Set\(\[([\s\S]*?)\]\);/u)?.[1] ?? "";
  assert.deepEqual([...skillDigestBlock.matchAll(/'([0-9a-f]{64})'/gu)].map((match) => match[1]), [
    "04ed8cc9f7cd7361d423fc03db7fce6dd9916615e9fe3c0a9e56e221e1858600",
    "9bd7838e897c033d600f7caa93a282c36284034f4d8e9215f68fb8edac879baa",
    "0f10693ea535ea263d25dcf7f7f503bee3c705847e9b10b2eb1272db4f71b1ee",
    "023d90536d5974e510910bb18fd11834386b5a8365116aa0218e911d1033f304",
    "164f8325b78527cf1aa0eff8427807cb2e8d8d84160df89f2e73504781e2986f",
  ]);
});

test("existing tier, verifier, and correction invariants remain explicit", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /Tier 1 selects `luna`/,
    /adaptive.*Tier 3.*`terra`/is,
    /mandatory high-reasoning verification/i,
    /After 2 correction rounds/i,
    /400 output tokens/i,
    /300 output tokens/i,
  ]);
});

test("routing reads and emits the persisted execution profile", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /\$CODEX_HOME\/sol-luna-handoff\.json/,
    /missing configuration.*`sol-luna`/is,
    /schemaVersion.*1/is,
    /executionProfile.*`adaptive`.*`sol-luna`/is,
    /Route: Tier N - \{reason\}; Profile: adaptive\|sol-luna; Scout: yes\|no; Planner: none\|compact\|full; Executor: luna\|terra/,
    /include the active profile.*executor brief/is,
  ]);
});

test("sol-luna keeps Sol planning and routes every tier to Luna", async () => {
  const [skill, luna, metadata] = await Promise.all([
    read("skill/sol-luna-handoff/SKILL.md"),
    read("skill/sol-luna-handoff/assets/luna-executor.toml"),
    read("skill/sol-luna-handoff/agents/openai.yaml"),
  ]);
  includesAll(skill, [
    /`sol-luna`.*Tier 1.*`luna_fast_executor`/is,
    /`sol-luna`.*Tier 2.*`luna_executor`/is,
    /`sol-luna`.*Tier 3.*`luna_executor`/is,
    /Tier 3.*full `sol_planner`.*mandatory high-reasoning verification/is,
    /never select `terra_executor`.*`sol-luna`/is,
    /Terra exceptions.*planning and verification evidence/is,
  ]);
  includesAll(luna, [
    /active profile/i,
    /`sol-luna`/,
    /do not request a Terra handoff/i,
    /binding decision.*Sol planning or verification/is,
  ]);
  includesAll(metadata, [/default.*Sol.*Luna/is, /adaptive.*explicit/is]);
});
