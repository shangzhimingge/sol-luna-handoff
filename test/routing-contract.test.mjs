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

test("release metadata and migration digests describe v1.4.0", async () => {
  const [pkg, readme, chinese, cli, powershell] = await Promise.all([
    read("package.json"), read("README.md"), read("README.zh-CN.md"), read("bin/cli.mjs"),
    read("skill/sol-luna-handoff/scripts/install-agents.ps1"),
  ]);
  assert.equal(JSON.parse(pkg).version, "1.4.0");
  includesAll(readme, [/1\.4\.0/, /v1\.4\.0/, /Luna-first/i, /six Terra exceptions/i]);
  includesAll(chinese, [/1\.4\.0/, /v1\.4\.0/, /Luna 优先/i, /六类 Terra 例外/i]);
  includesAll(cli, [
    /023d90536d5974e510910bb18fd11834386b5a8365116aa0218e911d1033f304/i,
    /721B9C4A60F66A729B409792FC6BF173678D7F62DEF82B36CA1123CC247515AC/i,
  ]);
  includesAll(powershell, [/721B9C4A60F66A729B409792FC6BF173678D7F62DEF82B36CA1123CC247515AC/i]);
  const skillDigestBlock = cli.match(/knownLegacySkillDigests = new Set\(\[([\s\S]*?)\]\);/u)?.[1] ?? "";
  assert.deepEqual([...skillDigestBlock.matchAll(/'([0-9a-f]{64})'/gu)].map((match) => match[1]), [
    "04ed8cc9f7cd7361d423fc03db7fce6dd9916615e9fe3c0a9e56e221e1858600",
    "9bd7838e897c033d600f7caa93a282c36284034f4d8e9215f68fb8edac879baa",
    "0f10693ea535ea263d25dcf7f7f503bee3c705847e9b10b2eb1272db4f71b1ee",
    "023d90536d5974e510910bb18fd11834386b5a8365116aa0218e911d1033f304",
  ]);
});

test("existing tier, verifier, and correction invariants remain explicit", async () => {
  const skill = await read("skill/sol-luna-handoff/SKILL.md");
  includesAll(skill, [
    /Tier 1 selects `luna`/,
    /Tier 3 always selects `terra`/,
    /mandatory high-reasoning verification/i,
    /After 2 correction rounds/i,
    /400 output tokens/i,
    /300 output tokens/i,
  ]);
});
