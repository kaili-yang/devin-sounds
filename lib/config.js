'use strict';
// User settings live in ~/.config/devin/devin-sounds/config.json; generated audio,
// throttle state and the voice list are cache data under ~/.cache/devin-sounds.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CATEGORIES = [
  'session.start', 'task.acknowledge', 'task.complete', 'task.error', 'input.required',
  'resource.limit', 'user.spam', 'session.end', 'task.progress',
];

function configDir(env = process.env) {
  return env.DEVIN_SOUNDS_HOME || path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'devin', 'devin-sounds');
}

function cacheDir(env = process.env) {
  return env.DEVIN_SOUNDS_CACHE || path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'devin-sounds');
}

const userPacksDir = (env) => path.join(configDir(env), 'packs');
const configPath = (env) => path.join(configDir(env), 'config.json');

function defaultPack() {
  return 'butler';
}

function defaults() {
  return {
    enabled: true,
    pack: defaultPack(),
    volume: 0.6,
    notify: false,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, c !== 'task.progress'])),
    errorCooldownSec: 20,
    minGapSec: 1.5,
  };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Defaults < config file < env. A broken file falls back to defaults: a typo must never break a session. */
function loadConfig(env = process.env) {
  const base = defaults();
  const file = readJson(configPath(env));
  const cfg = file && typeof file === 'object' ? { ...base, ...file, categories: { ...base.categories, ...(file.categories || {}) } } : base;
  if (env.DEVIN_SOUNDS_PACK) cfg.pack = env.DEVIN_SOUNDS_PACK;
  if (env.DEVIN_SOUNDS_VOLUME) cfg.volume = Number(env.DEVIN_SOUNDS_VOLUME);
  if (env.DEVIN_SOUNDS_DISABLE === '1') cfg.enabled = false;
  cfg.volume = Math.min(1, Math.max(0, Number.isFinite(cfg.volume) ? cfg.volume : base.volume));
  return cfg;
}

function saveConfig(patch, env = process.env) {
  const file = configPath(env);
  const current = readJson(file) || {};
  const next = { ...current, ...patch };
  if (patch.categories) next.categories = { ...(current.categories || {}), ...patch.categories };
  writeJsonAtomic(file, next);
  return loadConfig(env);
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

module.exports = { CATEGORIES, configDir, cacheDir, userPacksDir, configPath, defaultPack, defaults, loadConfig, saveConfig, readJson, writeJsonAtomic };
