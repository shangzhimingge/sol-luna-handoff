import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
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
const npmCli = process.env.npm_execpath
  ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const agentFiles = [
  'sol-planner.toml',
  'sol-compact-planner.toml',
  'luna-scout.toml',
  'terra-executor.toml',
  'luna-executor.toml',
  'luna-fast-executor.toml',
];
const requiredPackageFiles = [
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'bin/cli.mjs',
  'docs/superpowers/plans/2026-09-01-sol-luna-default.md',
  'docs/superpowers/plans/2026-09-01-sol-luna-profile.md',
  'docs/superpowers/specs/2026-08-30-tier2-luna-first-design.md',
  'docs/superpowers/specs/2026-09-01-sol-luna-default-design.md',
  'docs/superpowers/specs/2026-09-01-sol-luna-profile-design.md',
  'package.json',
  'skill/sol-luna-handoff/SKILL.md',
  'skill/sol-luna-handoff/agents/openai.yaml',
  'skill/sol-luna-handoff/assets/global-agents.md',
  ...agentFiles.map((fileName) => `skill/sol-luna-handoff/assets/${fileName}`),
  'skill/sol-luna-handoff/scripts/install-agents.ps1',
];

function makeTemporaryDirectory(t, prefix) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
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

function snapshot(directory) {
  if (!existsSync(directory)) return { exists: false };
  const files = {};
  for (const relative of listFiles(directory)) {
    const absolute = path.join(directory, ...relative.split('/'));
    files[relative] = {
      hash: createHash('sha256').update(readFileSync(absolute)).digest('hex'),
      mtimeMs: statSync(absolute).mtimeMs,
    };
  }
  return { exists: true, files };
}

function pack(t) {
  const outputDirectory = makeTemporaryDirectory(t, 'sol-luna-pack-');
  const cache = makeTemporaryDirectory(t, 'sol-luna-pack-cache-');
  const result = spawnSync(
    process.execPath,
    [npmCli, 'pack', '--json', '--pack-destination', outputDirectory],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: cache,
        npm_config_update_notifier: 'false',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const metadata = JSON.parse(result.stdout);
  assert.equal(metadata.length, 1);
  return {
    metadata: metadata[0],
    tarball: path.join(outputDirectory, metadata[0].filename),
    cache,
  };
}

function runPackedCli(tarball, cache, codexHome, args = []) {
  return spawnSync(
    process.execPath,
    [
      npmCli,
      'exec',
      '--yes',
      '--offline',
      '--cache',
      cache,
      `--package=${tarball}`,
      '--',
      'sol-luna-handoff',
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        npm_config_update_notifier: 'false',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
      },
    },
  );
}

test('npm pack contains the complete runtime and excludes development-only files', (t) => {
  const { metadata, tarball } = pack(t);
  const files = metadata.files.map(({ path: filePath }) => filePath).sort();

  assert.equal(existsSync(tarball), true);
  for (const required of requiredPackageFiles) {
    assert.ok(files.includes(required), `Missing required package file: ${required}`);
  }
  assert.deepEqual(files, [...requiredPackageFiles].sort(), 'packed file manifest changed unexpectedly');
  assert.equal(files.some((file) => file.startsWith('test/')), false, 'root test sources were packaged');
  assert.equal(files.some((file) => /(?:^|\/)tests?\//u.test(file)), false, 'test sources were packaged');
  assert.equal(files.some((file) => file.startsWith('.github/')), false, 'GitHub workflow files were packaged');
  assert.equal(files.some((file) => file.startsWith('work/')), false, 'temporary work files were packaged');
  assert.equal(files.some((file) => file.includes('.worktrees/')), false, 'worktree files were packaged');
});

test('the packed package installs, diagnoses, reinstalls idempotently, and uninstalls through npm exec', async (t) => {
  const { tarball, cache } = pack(t);
  const codexHome = makeTemporaryDirectory(t, 'sol-luna-packed-home-');
  const originalGlobal = '# Existing global rules\n';
  writeFileSync(path.join(codexHome, 'AGENTS.md'), originalGlobal, 'utf8');

  const installed = runPackedCli(tarball, cache, codexHome, ['install']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.stdout, /Installed Sol.*Luna Handoff/u);
  assert.equal(existsSync(path.join(codexHome, 'skills', 'sol-luna-handoff', 'SKILL.md')), true);
  assert.deepEqual(JSON.parse(readFileSync(path.join(codexHome, 'sol-luna-handoff.json'), 'utf8')), {
    schemaVersion: 1,
    executionProfile: 'sol-luna',
  });
  for (const fileName of agentFiles) {
    assert.equal(existsSync(path.join(codexHome, 'agents', fileName)), true, `Agent missing: ${fileName}`);
  }

  const healthy = runPackedCli(tarball, cache, codexHome, ['doctor']);
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.match(healthy.stdout, /Installation is healthy/);

  const beforeReinstall = snapshot(codexHome);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const reinstalled = runPackedCli(tarball, cache, codexHome, ['install']);
  assert.equal(reinstalled.status, 0, reinstalled.stderr);
  assert.match(reinstalled.stdout, /already up to date/i);
  assert.deepEqual(snapshot(codexHome), beforeReinstall);

  const uninstalled = runPackedCli(tarball, cache, codexHome, ['uninstall']);
  assert.equal(uninstalled.status, 0, uninstalled.stderr);
  assert.equal(existsSync(path.join(codexHome, 'skills', 'sol-luna-handoff')), false);
  for (const fileName of agentFiles) {
    assert.equal(existsSync(path.join(codexHome, 'agents', fileName)), false, `Agent remains: ${fileName}`);
  }
  assert.equal(readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8'), originalGlobal);
});

test('the packed package supports the sol-luna profile lifecycle', (t) => {
  const { tarball, cache } = pack(t);
  const codexHome = makeTemporaryDirectory(t, 'sol-luna-packed-profile-home-');

  const installed = runPackedCli(tarball, cache, codexHome, ['install', '--profile', 'sol-luna']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.deepEqual(JSON.parse(readFileSync(path.join(codexHome, 'sol-luna-handoff.json'), 'utf8')), {
    schemaVersion: 1,
    executionProfile: 'sol-luna',
  });
  const healthy = runPackedCli(tarball, cache, codexHome, ['doctor', '--profile', 'sol-luna']);
  assert.equal(healthy.status, 0, healthy.stderr);
  const uninstalled = runPackedCli(tarball, cache, codexHome, ['uninstall']);
  assert.equal(uninstalled.status, 0, uninstalled.stderr);
  assert.equal(existsSync(path.join(codexHome, 'sol-luna-handoff.json')), false);
});

test('the PowerShell installer exposes an atomic profile contract', () => {
  const script = readFileSync(path.join(root, 'skill', 'sol-luna-handoff', 'scripts', 'install-agents.ps1'), 'utf8');
  assert.match(script, /ValidateSet\('adaptive',\s*'sol-luna'\)/);
  assert.match(script, /\[string\]\$Profile\s*=\s*'sol-luna'/);
  assert.match(script, /sol-luna-handoff\.json/);
  assert.match(script, /executionProfile/);
  assert.match(script, /Write-BytesAtomically[^]*profile/i);
});
