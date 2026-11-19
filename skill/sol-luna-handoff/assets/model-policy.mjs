import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaults = Object.freeze({ sol: 'gpt-6.2-sol', luna: 'gpt-6-luna' });
export const preferred = defaults;
const efforts = { sol: ['medium', 'high'], luna: ['low', 'medium'] };
const families = Object.keys(efforts);
const slugPattern = (family) => new RegExp('^gpt-([1-9][0-9]{0,2})(?:\\.([0-9]{1,3}))?-' + family + '$');
export const policyPath = (home) => path.join(home, 'sol-luna-models.json');

export function readCatalog(home, now = Date.now()) {
  try {
    const { fetched_at, models } = JSON.parse(readFileSync(path.join(home, 'models_cache.json'), 'utf8'));
    const age = now - Date.parse(fetched_at);
    return age >= 0 && age <= 7 * 86400000 && Array.isArray(models) ? models : null;
  } catch { return null; }
}

function candidateModels(catalog, family) {
  return (catalog ?? []).flatMap((entry) => {
    const match = typeof entry?.slug === 'string' && slugPattern(family).exec(entry.slug);
    if (!match || entry.visibility !== 'list' || !Array.isArray(entry.supported_reasoning_levels)) return [];
    if (!efforts[family].every((effort) => entry.supported_reasoning_levels.some((level) => level?.effort === effort))) return [];
    return [{ slug: entry.slug, version: +match[1] * 1000 + +(match[2] ?? 0) }];
  }).sort((a, b) => b.version - a.version || a.slug.localeCompare(b.slug));
}

function validPair(pair) {
  return pair && Object.keys(pair).length === 2 &&
    families.every((family) => typeof pair[family] === 'string' && slugPattern(family).test(pair[family]));
}

export function inspectPolicy(home) {
  const file = policyPath(home);
  try {
    if (!lstatSync(file).isFile()) throw new Error('expected a regular file');
    const text = readFileSync(file, 'utf8');
    const state = JSON.parse(text);
    if (Object.keys(state).sort().join(',') !== 'mode,preferred,schemaVersion,selected' ||
        state.schemaVersion !== 1 || !['auto', 'pinned'].includes(state.mode) ||
        !validPair(state.selected) || !validPair(state.preferred)) throw new Error('unrecognized format');
    return { text, state };
  } catch (error) {
    if (error.code === 'ENOENT') return { text: null, state: null };
    throw new Error('Model configuration collision: ' + file + ': ' + error.message);
  }
}

export function planModels(home, action = 'refresh', pinned) {
  const { text, state } = inspectPolicy(home);
  const catalog = readCatalog(home);
  const mode = action === 'set' ? 'pinned' : action === 'auto' ? 'auto' : (state?.mode ?? 'auto');
  const candidates = Object.fromEntries(families.map((family) => [family, candidateModels(catalog, family)]));
  let selected;
  if (action === 'set') {
    for (const family of families) {
      if (!candidates[family].some(({ slug }) => slug === pinned[family])) {
        throw new Error('Model for ' + family + ' is not listed with the required reasoning levels in a fresh Codex model cache: ' + pinned[family]);
      }
    }
    selected = pinned;
  } else if (mode === 'pinned') selected = state.selected;
  else {
    selected = Object.fromEntries(families.map((family) =>
      [family, candidates[family][0]?.slug ?? state?.selected[family] ?? defaults[family]]));
  }
  const nextState = { schemaVersion: 1, mode, preferred, selected };
  const stateText = JSON.stringify(nextState, null, 2) + '\n';
  return { ...nextState, installed: state?.selected ?? null, cacheFresh: catalog !== null, changed: stateText !== text, stateText };
}

export function renderAgent(template, model) {
  const modelLine = /^model = "gpt-[0-9.]+-(?:sol|luna)"(?=\r?$)/m;
  if (!modelLine.test(template)) throw new Error('Bundled agent template is missing its model line');
  return template.replace(modelLine, 'model = "' + model + '"');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, home] = process.argv.slice(2);
    if (command !== 'resolve' || !home || process.argv.length !== 4) throw new Error('Usage: model-policy.mjs resolve CODEX_HOME');
    console.log(JSON.stringify(planModels(home)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
