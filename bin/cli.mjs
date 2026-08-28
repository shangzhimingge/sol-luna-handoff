#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledSkill = path.join(packageRoot, 'skill', 'sol-luna-handoff');
const assetsDirectory = path.join(bundledSkill, 'assets');
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
const knownLegacySkillDigests = new Set([
  '04ed8cc9f7cd7361d423fc03db7fce6dd9916615e9fe3c0a9e56e221e1858600',
  '9bd7838e897c033d600f7caa93a282c36284034f4d8e9215f68fb8edac879baa',
  '0f10693ea535ea263d25dcf7f7f503bee3c705847e9b10b2eb1272db4f71b1ee',
]);
const knownLegacyAgentHashes = new Map([
  ['sol-planner.toml', new Set([
    '7B6FB8A14C22354125C08BC255F4203B7BF8EBF505209402FA8A7BBD91EBA431',
    '140A285E3485546848294A9DE46AA96E7B021B24AA8A83BC8E546854D9B93B4F',
  ])],
  ['sol-compact-planner.toml', new Set([
    'E8E9F21443434F523AA71DF343965ACDE93AD8ECEC3293F90F8386E4A5046A36',
    '2C7A9FE24E737DC1DD3D6E97CAC9745EB42CA0174587DEB083FC66C7C07DAA8A',
  ])],
  ['luna-executor.toml', new Set([
    '292F88AA10D75147F3287AB54E73F0C4C2CE4BF98211F1A8944C789DDF7A7D8F',
    '5BC8230908773356A53BD51F148F8DE116FD8A0283636215ABEA046BB62E2EFA',
    '91AA121E7248CA507FFB594D7768595E1E0C6267BD5435745DC2573DAB9957FA',
    '89864C97A3DC252F684CA46BC405E414D4811465517F5D721AABC9C8AAE2669D',
  ])],
  ['luna-fast-executor.toml', new Set([
    '5400B0F6F9EE8CAAD4678779A6FB89F99C59835669BF579DD0A70F1F05BF9393',
    '099C58C9F0AF4B6B2A0F923782E0953BB798FB8AA48ED29EDF7E2550EAA3F5A6',
  ])],
]);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function usage() {
  return `Sol → Terra/Luna Handoff installer

Usage:
  sol-luna-handoff [install|doctor|uninstall]
  sol-luna-handoff --help

Commands:
  install    Install or safely upgrade the Skill, six agents, and global rule (default)
  doctor     Check the complete installation without changing files
  uninstall  Remove only exact managed content

Environment:
  CODEX_HOME  Target Codex directory (default: ~/.codex)
`;
}

function codexPaths() {
  const codexHome = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
  return {
    codexHome,
    skillTarget: path.join(codexHome, 'skills', 'sol-luna-handoff'),
    agentsDirectory: path.join(codexHome, 'agents'),
    globalAgentsPath: path.join(codexHome, 'AGENTS.md'),
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function bytesEqual(left, right) {
  return left.length === right.length && left.equals(right);
}

function readUtf8(file) {
  return utf8Decoder.decode(readFileSync(file));
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, '\n');
}

function normalizedFileEqual(left, right) {
  try {
    return normalizeText(readUtf8(left)) === normalizeText(readUtf8(right));
  } catch {
    return bytesEqual(readFileSync(left), readFileSync(right));
  }
}

function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative.split(path.sep).join('/'));
    else throw new Error(`Unsupported file type in bundled Skill: ${absolute}`);
  }
  return files.sort();
}

function treeDigest(directory) {
  const digest = createHash('sha256');
  for (const relative of listFiles(directory)) {
    const absolute = path.join(directory, ...relative.split('/'));
    let content;
    try {
      content = normalizeText(readUtf8(absolute));
    } catch {
      content = readFileSync(absolute);
    }
    digest.update(relative);
    digest.update('\0');
    digest.update(content);
    digest.update('\0');
  }
  return digest.digest('hex');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markerCount(content, marker) {
  return [...content.matchAll(new RegExp(`^[ \\t]*${escapeRegExp(marker)}[ \\t]*\\r?$`, 'gm'))].length;
}

function inspectGlobalContent(content, fileLabel) {
  const starts = markerCount(content, startMarker);
  const ends = markerCount(content, endMarker);
  if (starts === 0 && ends === 0) return { kind: 'absent' };
  if (starts !== 1 || ends !== 1) {
    throw new Error(`Expected zero or one managed global rule block; managed global rule markers are malformed in ${fileLabel}`);
  }
  const pattern = new RegExp(
    `^[ \\t]*${escapeRegExp(startMarker)}[ \\t]*\\r?\\n[\\s\\S]*?^[ \\t]*${escapeRegExp(endMarker)}[ \\t]*(?:\\r?\\n)?`,
    'm',
  );
  const match = pattern.exec(content);
  if (!match) throw new Error(`Managed global rule markers are malformed in ${fileLabel}`);
  return { kind: 'present', index: match.index, text: match[0] };
}

function bundledManagedBlock() {
  const file = path.join(assetsDirectory, 'global-agents.md');
  const content = readUtf8(file);
  const inspection = inspectGlobalContent(content, file);
  if (inspection.kind !== 'present' || inspection.index !== 0 || inspection.text.trimEnd() !== content.trimEnd()) {
    throw new Error(`Managed global rule must contain exactly one complete marker-delimited block: ${file}`);
  }
  return content;
}

function newlineFor(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeBlock(block, newline) {
  return normalizeText(block).trimEnd().replace(/\n/g, newline) + newline;
}

function installGlobalContent(existing, block, fileLabel) {
  const inspection = inspectGlobalContent(existing, fileLabel);
  const newline = newlineFor(existing);
  const normalizedBlock = normalizeBlock(block, newline);
  if (inspection.kind === 'present') {
    return existing.slice(0, inspection.index) + normalizedBlock + existing.slice(inspection.index + inspection.text.length);
  }
  if (existing.length === 0) return normalizedBlock;
  return existing + (existing.endsWith('\n') || existing.endsWith('\r') ? '' : newline) + normalizedBlock;
}

function uninstallGlobalContent(existing, block, fileLabel) {
  const inspection = inspectGlobalContent(existing, fileLabel);
  if (inspection.kind === 'absent') return existing;
  if (normalizeText(inspection.text).trimEnd() !== normalizeText(block).trimEnd()) {
    throw new Error(`Refusing to uninstall: managed global rule was customized in ${fileLabel}`);
  }
  return existing.slice(0, inspection.index) + existing.slice(inspection.index + inspection.text.length);
}

function inspectSkill(target) {
  if (!existsSync(target)) return { state: 'missing' };
  if (!statSync(target).isDirectory()) return { state: 'changed' };
  const targetDigest = treeDigest(target);
  const sourceDigest = treeDigest(bundledSkill);
  if (targetDigest === sourceDigest) return { state: 'current', digest: targetDigest };
  if (knownLegacySkillDigests.has(targetDigest)) return { state: 'legacy', digest: targetDigest };
  return { state: 'changed', digest: targetDigest };
}

function inspectAgent(fileName, target) {
  if (!existsSync(target)) return { state: 'missing' };
  if (!statSync(target).isFile()) return { state: 'changed' };
  const source = path.join(assetsDirectory, fileName);
  if (normalizedFileEqual(source, target)) return { state: 'current' };
  const hash = sha256(readFileSync(target)).toUpperCase();
  if (knownLegacyAgentHashes.get(fileName)?.has(hash)) return { state: 'legacy' };
  return { state: 'changed' };
}

function inspectGlobal(file, block) {
  if (!existsSync(file)) return { state: 'missing', content: '' };
  if (!statSync(file).isFile()) return { state: 'changed' };
  const content = readUtf8(file);
  const inspection = inspectGlobalContent(content, file);
  if (inspection.kind === 'absent') return { state: 'missing', content };
  const current = normalizeText(inspection.text).trimEnd() === normalizeText(block).trimEnd();
  return { state: current ? 'current' : 'changed', content };
}

function ensureDirectory(directory) {
  mkdirSync(directory, { recursive: true });
}

function copyDirectory(source, destination) {
  ensureDirectory(destination);
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
    else throw new Error(`Unsupported file type in bundled Skill: ${from}`);
  }
}

function atomicWrite(file, bytes) {
  const directory = path.dirname(file);
  ensureDirectory(directory);
  const id = randomUUID().replaceAll('-', '');
  const temporary = path.join(directory, `.${path.basename(file)}.${id}.tmp`);
  const backup = path.join(directory, `.${path.basename(file)}.${id}.bak`);
  writeFileSync(temporary, bytes);
  try {
    if (existsSync(file)) renameSync(file, backup);
    renameSync(temporary, file);
    rmSync(backup, { force: true });
  } catch (error) {
    rmSync(temporary, { force: true });
    if (existsSync(backup) && !existsSync(file)) renameSync(backup, file);
    throw error;
  }
}

function replaceSkillDirectory(source, target) {
  const parent = path.dirname(target);
  ensureDirectory(parent);
  const id = randomUUID().replaceAll('-', '');
  const staged = path.join(parent, `.sol-luna-handoff.${id}.tmp`);
  const backup = path.join(parent, `.sol-luna-handoff.${id}.bak`);
  copyDirectory(source, staged);
  try {
    if (existsSync(target)) renameSync(target, backup);
    renameSync(staged, target);
    return {
      commit() {
        rmSync(backup, { recursive: true, force: true });
      },
      rollback() {
        rmSync(target, { recursive: true, force: true });
        if (existsSync(backup)) renameSync(backup, target);
      },
    };
  } catch (error) {
    rmSync(staged, { recursive: true, force: true });
    if (existsSync(backup) && !existsSync(target)) renameSync(backup, target);
    throw error;
  }
}

function captureFile(file) {
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file) : null;
}

function restoreFile(file, bytes) {
  if (bytes === null) rmSync(file, { force: true });
  else atomicWrite(file, bytes);
}

function planInstall(paths) {
  const block = bundledManagedBlock();
  const skill = inspectSkill(paths.skillTarget);
  if (skill.state === 'changed') throw new Error(`Installed Skill collision: destination contains unrecognized content: ${paths.skillTarget}`);

  const agents = agentFiles.map((fileName) => {
    const target = path.join(paths.agentsDirectory, fileName);
    const inspection = inspectAgent(fileName, target);
    if (inspection.state === 'changed') throw new Error(`Custom-agent collision: destination exists with different content: ${target}`);
    return { fileName, target, state: inspection.state };
  });

  const existingGlobal = existsSync(paths.globalAgentsPath) ? readUtf8(paths.globalAgentsPath) : '';
  const updatedGlobal = installGlobalContent(existingGlobal, block, paths.globalAgentsPath);
  return {
    block,
    skill,
    agents,
    existingGlobal,
    updatedGlobal,
    changed: skill.state !== 'current' || agents.some((agent) => agent.state !== 'current') || updatedGlobal !== existingGlobal,
  };
}

function applyInstall(paths, plan) {
  const oldAgents = new Map(plan.agents.map(({ target }) => [target, captureFile(target)]));
  const oldGlobal = existsSync(paths.globalAgentsPath) ? readFileSync(paths.globalAgentsPath) : null;
  let skillTransaction = null;
  try {
    if (plan.skill.state !== 'current') skillTransaction = replaceSkillDirectory(bundledSkill, paths.skillTarget);
    for (const agent of plan.agents) {
      if (agent.state !== 'current') atomicWrite(agent.target, readFileSync(path.join(assetsDirectory, agent.fileName)));
    }
    if (plan.updatedGlobal !== plan.existingGlobal) atomicWrite(paths.globalAgentsPath, Buffer.from(plan.updatedGlobal, 'utf8'));
    const health = collectHealth(paths, plan.block);
    if (!health.healthy) throw new Error('Post-install verification failed');
    skillTransaction?.commit();
  } catch (error) {
    skillTransaction?.rollback();
    for (const [target, bytes] of oldAgents) restoreFile(target, bytes);
    restoreFile(paths.globalAgentsPath, oldGlobal);
    throw error;
  }
}

function collectHealth(paths, block = bundledManagedBlock()) {
  const skill = inspectSkill(paths.skillTarget);
  const agents = agentFiles.map((fileName) => ({
    fileName,
    state: inspectAgent(fileName, path.join(paths.agentsDirectory, fileName)).state,
  }));
  let global;
  try {
    global = inspectGlobal(paths.globalAgentsPath, block);
  } catch (error) {
    global = { state: 'changed', error: error.message };
  }
  return {
    skill,
    agents,
    global,
    healthy: skill.state === 'current' && agents.every((agent) => agent.state === 'current') && global.state === 'current',
  };
}

function install() {
  const paths = codexPaths();
  const plan = planInstall(paths);
  if (!plan.changed) {
    console.log('Sol → Terra/Luna Handoff is already up to date.');
    return;
  }
  applyInstall(paths, plan);
  console.log('Installed Sol → Terra/Luna Handoff.');
  console.log(`  Skill: ${paths.skillTarget}`);
  console.log(`  Agents: ${paths.agentsDirectory} (${agentFiles.length})`);
  console.log(`  Global rule: ${paths.globalAgentsPath}`);
  console.log('Start a new Codex task if the current app session has cached agent discovery.');
}

function doctor() {
  const paths = codexPaths();
  const health = collectHealth(paths);
  console.log(`Skill: ${health.skill.state}`);
  for (const agent of health.agents) console.log(`Agent ${agent.fileName}: ${agent.state}`);
  console.log(`Global rule: ${health.global.state}`);
  if (health.global.error) console.log(`  ${health.global.error}`);
  if (!health.healthy) {
    process.exitCode = 1;
    return;
  }
  console.log('Installation is healthy.');
}

function planUninstall(paths) {
  const block = bundledManagedBlock();
  const skill = inspectSkill(paths.skillTarget);
  if (skill.state === 'changed') throw new Error(`Refusing to uninstall: installed Skill was customized: ${paths.skillTarget}`);
  const agents = agentFiles.map((fileName) => {
    const target = path.join(paths.agentsDirectory, fileName);
    const inspection = inspectAgent(fileName, target);
    if (inspection.state === 'changed') throw new Error(`Refusing to uninstall: managed agent was customized: ${target}`);
    return { fileName, target, state: inspection.state };
  });
  const existingGlobal = existsSync(paths.globalAgentsPath) ? readUtf8(paths.globalAgentsPath) : '';
  const updatedGlobal = uninstallGlobalContent(existingGlobal, block, paths.globalAgentsPath);
  return { skill, agents, existingGlobal, updatedGlobal };
}

function uninstall() {
  const paths = codexPaths();
  const plan = planUninstall(paths);
  if (plan.skill.state === 'missing' && plan.agents.every((agent) => agent.state === 'missing') && plan.updatedGlobal === plan.existingGlobal) {
    console.log('Sol → Terra/Luna Handoff is not installed.');
    return;
  }
  const transactionId = randomUUID().replaceAll('-', '');
  const skillBackup = `${paths.skillTarget}.${transactionId}.uninstall`;
  const oldAgents = new Map(plan.agents.map(({ target }) => [target, captureFile(target)]));
  const oldGlobal = existsSync(paths.globalAgentsPath) ? readFileSync(paths.globalAgentsPath) : null;
  let skillMoved = false;
  try {
    if (plan.skill.state !== 'missing') {
      renameSync(paths.skillTarget, skillBackup);
      skillMoved = true;
    }
    for (const agent of plan.agents) {
      if (agent.state !== 'missing') rmSync(agent.target, { force: true });
    }
    if (plan.updatedGlobal !== plan.existingGlobal) atomicWrite(paths.globalAgentsPath, Buffer.from(plan.updatedGlobal, 'utf8'));
    rmSync(skillBackup, { recursive: true, force: true });
  } catch (error) {
    if (skillMoved) {
      rmSync(paths.skillTarget, { recursive: true, force: true });
      if (existsSync(skillBackup)) renameSync(skillBackup, paths.skillTarget);
    }
    for (const [target, bytes] of oldAgents) restoreFile(target, bytes);
    restoreFile(paths.globalAgentsPath, oldGlobal);
    throw error;
  }
  console.log('Uninstalled Sol → Terra/Luna Handoff managed content.');
}

function main() {
  const [command = 'install', ...extra] = process.argv.slice(2);
  if (command === '--help' || command === '-h' || command === 'help') {
    console.log(usage());
    return;
  }
  if (extra.length > 0) throw new Error(`Unexpected arguments: ${extra.join(' ')}`);
  if (command === 'install') install();
  else if (command === 'doctor') doctor();
  else if (command === 'uninstall') uninstall();
  else throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`sol-luna-handoff: ${error.message}`);
  process.exitCode = 1;
}
