import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(root, 'bin', 'cli.mjs');
const bundledSkill = path.join(root, 'skill', 'sol-luna-handoff');
const assets = path.join(bundledSkill, 'assets');
const agentFiles = [
  'sol-planner.toml',
  'sol-compact-planner.toml',
  'luna-scout.toml',
  'terra-executor.toml',
  'luna-executor.toml',
  'luna-fast-executor.toml',
];
const startMarker = '<!-- BEGIN SOL-LUNA-HANDOFF MANAGED BLOCK -->';
const endMarker = '<!-- END SOL-LUNA-HANDOFF MANAGED BLOCK -->';

function makeCodexHome(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sol-luna-cli-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(codexHome, args = [], env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CODEX_HOME: codexHome, ...env },
  });
}

function listFiles(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(absolute, relative));
    else output.push(relative.split(path.sep).join('/'));
  }
  return output.sort();
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function snapshot(directory) {
  if (!existsSync(directory)) return { exists: false };
  const files = {};
  for (const relative of listFiles(directory)) {
    const absolute = path.join(directory, relative);
    files[relative] = {
      hash: hashFile(absolute),
      mtimeMs: statSync(absolute).mtimeMs,
    };
  }
  return { exists: true, files };
}

function assertInstalled(codexHome) {
  const installedSkill = path.join(codexHome, 'skills', 'sol-luna-handoff');
  assert.deepEqual(listFiles(installedSkill), listFiles(bundledSkill));
  for (const relative of listFiles(bundledSkill)) {
    assert.equal(
      hashFile(path.join(installedSkill, relative)),
      hashFile(path.join(bundledSkill, relative)),
      `Skill file differs: ${relative}`,
    );
  }
  for (const fileName of agentFiles) {
    assert.equal(
      hashFile(path.join(codexHome, 'agents', fileName)),
      hashFile(path.join(assets, fileName)),
      `Agent differs: ${fileName}`,
    );
  }
  const globalRules = readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8');
  assert.equal(globalRules.split(startMarker).length - 1, 1);
  assert.equal(globalRules.split(endMarker).length - 1, 1);
  assert.match(globalRules, /\$sol-luna-handoff/);
}

function restoreTaggedSkill(tag, destination) {
  const prefix = 'skill/sol-luna-handoff/';
  const listing = spawnSync('git', ['ls-tree', '-r', '--name-only', tag, 'skill/sol-luna-handoff'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(listing.status, 0, listing.stderr);
  for (const repositoryPath of listing.stdout.trim().split(/\r?\n/u)) {
    const relative = repositoryPath.slice(prefix.length);
    const file = spawnSync('git', ['show', `${tag}:${repositoryPath}`], {
      cwd: root,
      encoding: null,
    });
    assert.equal(file.status, 0, file.stderr?.toString());
    const target = path.join(destination, ...relative.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.stdout);
  }
}

function contentSnapshot(directory) {
  if (!existsSync(directory)) return { exists: false };
  const files = {};
  for (const relative of listFiles(directory)) {
    files[relative] = hashFile(path.join(directory, ...relative.split('/')));
  }
  return { exists: true, files };
}

function restoreTaggedFile(tag, repositoryPath, destination) {
  const file = spawnSync('git', ['show', `${tag}:${repositoryPath}`], {
    cwd: root,
    encoding: null,
  });
  assert.equal(file.status, 0, file.stderr?.toString());
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, file.stdout);
}

function hasGitTag(tag) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
    cwd: root,
    encoding: 'utf8',
  }).status === 0;
}

test('no arguments performs a complete install and preserves unrelated global rules', (t) => {
  const codexHome = makeCodexHome(t);
  writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Existing rules\n', 'utf8');

  const result = runCli(codexHome);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed Sol.*Luna Handoff/u);
  assertInstalled(codexHome);
  assert.match(readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), /^# Existing rules\n/u);
});

test('reinstall is idempotent and leaves file timestamps unchanged', async (t) => {
  const codexHome = makeCodexHome(t);
  assert.equal(runCli(codexHome, ['install']).status, 0);
  const before = snapshot(codexHome);

  await new Promise((resolve) => setTimeout(resolve, 30));
  const result = runCli(codexHome, ['install']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(codexHome), before);
  assert.match(result.stdout, /already up to date/i);
});

test('agent collision aborts before any target is changed', (t) => {
  const codexHome = makeCodexHome(t);
  const agents = path.join(codexHome, 'agents');
  mkdirSync(agents, { recursive: true });
  writeFileSync(path.join(agents, 'terra-executor.toml'), 'custom definition\n', 'utf8');
  writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Keep me\n', 'utf8');
  const before = snapshot(codexHome);

  const result = runCli(codexHome, ['install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Custom-agent collision.*terra-executor\.toml/s);
  assert.deepEqual(snapshot(codexHome), before);
});

test('unknown installed Skill content aborts before any target is changed', (t) => {
  const codexHome = makeCodexHome(t);
  const installedSkill = path.join(codexHome, 'skills', 'sol-luna-handoff');
  cpSync(bundledSkill, installedSkill, { recursive: true });
  writeFileSync(path.join(installedSkill, 'SKILL.md'), 'locally customized\n', 'utf8');
  const before = snapshot(codexHome);

  const result = runCli(codexHome, ['install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Installed Skill collision/);
  assert.deepEqual(snapshot(codexHome), before);
});

test('a Skill target that is a file fails closed without touching other targets', (t) => {
  const codexHome = makeCodexHome(t);
  const skillTarget = path.join(codexHome, 'skills', 'sol-luna-handoff');
  mkdirSync(path.dirname(skillTarget), { recursive: true });
  writeFileSync(skillTarget, 'occupied by a file\n', 'utf8');
  writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Keep me\n', 'utf8');
  const before = contentSnapshot(codexHome);

  const result = runCli(codexHome, ['install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Installed Skill collision.*sol-luna-handoff/s);
  assert.deepEqual(contentSnapshot(codexHome), before);
});

test('an agent target that is a directory fails closed without touching other targets', (t) => {
  const codexHome = makeCodexHome(t);
  const target = path.join(codexHome, 'agents', 'terra-executor.toml');
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Keep me\n', 'utf8');
  const before = snapshot(codexHome);

  const result = runCli(codexHome, ['install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Custom-agent collision.*terra-executor\.toml/s);
  assert.deepEqual(snapshot(codexHome), before);
});

test('an exact v1.1 Skill tree is recognized and upgraded', (t) => {
  if (!hasGitTag('v1.1.0')) {
    t.skip('v1.1.0 tag is absent in this checkout');
    return;
  }
  const codexHome = makeCodexHome(t);
  const installedSkill = path.join(codexHome, 'skills', 'sol-luna-handoff');
  restoreTaggedSkill('v1.1.0', installedSkill);

  const result = runCli(codexHome, ['install']);

  assert.equal(result.status, 0, result.stderr);
  assertInstalled(codexHome);
});

test('an exact v1.3.1 installation is atomically upgraded with global rules preserved', (t) => {
  if (!hasGitTag('v1.3.1')) {
    t.skip('v1.3.1 tag is absent in this checkout');
    return;
  }
  const codexHome = makeCodexHome(t);
  const installedSkill = path.join(codexHome, 'skills', 'sol-luna-handoff');
  restoreTaggedSkill('v1.3.1', installedSkill);
  for (const fileName of agentFiles) {
    restoreTaggedFile(
      'v1.3.1',
      `skill/sol-luna-handoff/assets/${fileName}`,
      path.join(codexHome, 'agents', fileName),
    );
    const restoredAgent = path.join(codexHome, 'agents', fileName);
    writeFileSync(restoredAgent, readFileSync(restoredAgent, 'utf8').replace(/\r?\n/gu, '\r\n'), 'utf8');
  }
  const legacyTerra = path.join(codexHome, 'agents', 'terra-executor.toml');
  assert.equal(hashFile(legacyTerra).toUpperCase(), '721B9C4A60F66A729B409792FC6BF173678D7F62DEF82B36CA1123CC247515AC');
  const unrelatedRules = '# Keep this user rule\n\n';
  writeFileSync(path.join(codexHome, 'AGENTS.md'), unrelatedRules, 'utf8');

  const result = runCli(codexHome, ['install']);

  assert.equal(result.status, 0, result.stderr);
  assertInstalled(codexHome);
  assert.match(readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), /^# Keep this user rule\n\n/u);
});

test('malformed managed markers abort before any target is changed', (t) => {
  const codexHome = makeCodexHome(t);
  writeFileSync(path.join(codexHome, 'AGENTS.md'), `${startMarker}\npartial\n`, 'utf8');
  const before = snapshot(codexHome);

  const result = runCli(codexHome, ['install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /managed global rule markers/i);
  assert.deepEqual(snapshot(codexHome), before);
});

for (const newline of ['\n', '\r\n']) {
  const label = newline === '\n' ? 'LF' : 'CRLF';
  test(`install, reinstall, and uninstall preserve ${label} plus the auto-resume managed block`, (t) => {
    const codexHome = makeCodexHome(t);
    const autoResumeBlock = [
      '<!-- BEGIN CODEX-AUTO-RESUME MANAGED BLOCK -->',
      '## Codex automatic resume preflight',
      '',
      'Keep this independent managed block byte-for-byte.',
      '<!-- END CODEX-AUTO-RESUME MANAGED BLOCK -->',
      '',
    ].join(newline);
    const original = ['# User rules', '', autoResumeBlock, '## Other rules', 'Keep this too.', ''].join(newline);
    const globalPath = path.join(codexHome, 'AGENTS.md');
    writeFileSync(globalPath, original, 'utf8');

    const installed = runCli(codexHome, ['install']);
    assert.equal(installed.status, 0, installed.stderr);
    const afterInstall = readFileSync(globalPath, 'utf8');
    assert.ok(afterInstall.includes(autoResumeBlock));
    assert.equal(afterInstall.split('<!-- BEGIN CODEX-AUTO-RESUME MANAGED BLOCK -->').length - 1, 1);
    assert.equal(afterInstall.split(startMarker).length - 1, 1);
    if (newline === '\r\n') assert.doesNotMatch(afterInstall, /(?<!\r)\n/u);
    else assert.doesNotMatch(afterInstall, /\r/u);

    const once = readFileSync(globalPath);
    const reinstalled = runCli(codexHome, ['install']);
    assert.equal(reinstalled.status, 0, reinstalled.stderr);
    assert.deepEqual(readFileSync(globalPath), once);

    const uninstalled = runCli(codexHome, ['uninstall']);
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    assert.equal(readFileSync(globalPath, 'utf8'), original);
  });
}

test('a failure after all install writes rolls Skill, agents, and global rules back exactly', (t) => {
  if (!hasGitTag('v1.1.0')) {
    t.skip('v1.1.0 tag is absent in this checkout');
    return;
  }
  const codexHome = makeCodexHome(t);
  const installedSkill = path.join(codexHome, 'skills', 'sol-luna-handoff');
  restoreTaggedSkill('v1.1.0', installedSkill);
  for (const fileName of ['sol-planner.toml', 'sol-compact-planner.toml', 'luna-executor.toml', 'luna-fast-executor.toml']) {
    restoreTaggedFile(
      'v1.1.0',
      `skill/sol-luna-handoff/assets/${fileName}`,
      path.join(codexHome, 'agents', fileName),
    );
  }
  const originalGlobal = [
    '# Existing rules',
    '<!-- BEGIN CODEX-AUTO-RESUME MANAGED BLOCK -->',
    'preserve me',
    '<!-- END CODEX-AUTO-RESUME MANAGED BLOCK -->',
    '',
  ].join('\r\n');
  writeFileSync(path.join(codexHome, 'AGENTS.md'), originalGlobal, 'utf8');
  const before = contentSnapshot(codexHome);

  const result = runCli(codexHome, ['install'], {
    NODE_ENV: 'test',
    SOL_LUNA_HANDOFF_TEST_FAULT: 'after-global-write',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Injected test fault: after-global-write/);
  assert.deepEqual(contentSnapshot(codexHome), before);
  assert.equal(readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), originalGlobal);
});

test('doctor is read-only and detects drift', (t) => {
  const codexHome = makeCodexHome(t);
  assert.equal(runCli(codexHome, ['install']).status, 0);

  const healthy = runCli(codexHome, ['doctor']);
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.match(healthy.stdout, /Installation is healthy/);

  writeFileSync(path.join(codexHome, 'agents', 'luna-scout.toml'), 'drift\n', 'utf8');
  const before = snapshot(codexHome);
  const drifted = runCli(codexHome, ['doctor']);
  assert.notEqual(drifted.status, 0);
  assert.match(drifted.stdout, /luna-scout\.toml.*changed/s);
  assert.deepEqual(snapshot(codexHome), before);
});

test('uninstall removes exact managed content and preserves unrelated AGENTS.md text', (t) => {
  const codexHome = makeCodexHome(t);
  writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Existing rules\n', 'utf8');
  assert.equal(runCli(codexHome, ['install']).status, 0);

  const result = runCli(codexHome, ['uninstall']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(codexHome, 'skills', 'sol-luna-handoff')), false);
  for (const fileName of agentFiles) {
    assert.equal(existsSync(path.join(codexHome, 'agents', fileName)), false);
  }
  const remaining = readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8');
  assert.equal(remaining, '# Existing rules\n');
  assert.doesNotMatch(remaining, /SOL-LUNA-HANDOFF MANAGED BLOCK/);
});

test('uninstall aborts without mutation when managed content was customized', (t) => {
  const codexHome = makeCodexHome(t);
  assert.equal(runCli(codexHome, ['install']).status, 0);
  writeFileSync(path.join(codexHome, 'agents', 'sol-planner.toml'), 'customized\n', 'utf8');
  const before = snapshot(codexHome);

  const result = runCli(codexHome, ['uninstall']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to uninstall.*sol-planner\.toml/s);
  assert.deepEqual(snapshot(codexHome), before);
});

test('help succeeds and an unknown command is rejected', (t) => {
  const codexHome = makeCodexHome(t);
  const help = runCli(codexHome, ['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /install\|doctor\|uninstall/);

  const unknown = runCli(codexHome, ['surprise']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown command: surprise/);
});
