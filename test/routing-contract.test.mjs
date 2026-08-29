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
  const [pkg, readme, chinese, cli] = await Promise.all([
    read("package.json"), read("README.md"), read("README.zh-CN.md"), read("bin/cli.mjs"),
  ]);
  assert.equal(JSON.parse(pkg).version, "1.4.0");
  includesAll(readme, [/1\.4\.0/, /v1\.4\.0/, /Luna-first/i, /six Terra exceptions/i]);
  includesAll(chinese, [/1\.4\.0/, /v1\.4\.0/, /Luna 优先/i, /六类 Terra 例外/i]);
  includesAll(cli, [
    /86bca345f4e8b10730665e63fbbe83466a9c5eee0572e44dc1acc7c37e718f9f/i,
    /721B9C4A60F66A729B409792FC6BF173678D7F62DEF82B36CA1123CC247515AC/i,
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
