'use strict';
// CESP v1.0 (OpenPeon) sound packs: a directory with an openpeon.json manifest.
// Built-in packs may describe a sound with `tts` (spoken on this machine) or `synth`
// (a generated chime) instead of a `file`, so the repo ships no third-party audio.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { cacheDir, userPacksDir, readJson } = require('./config');

const BUILTIN_DIR = path.join(__dirname, '..', 'packs');
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
// CESP says a category with no sounds plays nothing; these two degrade to a close match instead.
const FALLBACK = { 'user.spam': 'task.acknowledge', 'task.progress': null };

/** Returns an error string, or null when the manifest is usable. */
function validateManifest(m) {
  if (!m || typeof m !== 'object') return 'manifest is not an object';
  if (typeof m.name !== 'string' || !NAME_RE.test(m.name)) return 'missing or invalid "name"';
  if (!m.categories || typeof m.categories !== 'object') return 'missing "categories"';
  for (const [cat, entry] of Object.entries(m.categories)) {
    if (!entry || !Array.isArray(entry.sounds)) return `category "${cat}" has no "sounds" array`;
    for (const s of entry.sounds) {
      if (!s || (typeof s.file !== 'string' && !s.tts && !s.synth)) return `a sound in "${cat}" has no "file", "tts" or "synth"`;
    }
  }
  return null;
}

function loadPackDir(dir, builtin) {
  const manifest = readJson(path.join(dir, 'openpeon.json'));
  const error = validateManifest(manifest);
  if (error) return { dir, builtin, error, name: path.basename(dir) };
  return { dir, builtin, name: manifest.name, displayName: manifest.display_name || manifest.name, language: manifest.language, manifest };
}

function listPacks(env = process.env) {
  const out = [];
  const seen = new Set();
  for (const [root, builtin] of [[userPacksDir(env), false], [BUILTIN_DIR, true]]) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const pack = loadPackDir(path.join(root, e.name), builtin);
      if (seen.has(pack.name)) continue; // a user pack overrides a built-in with the same name
      seen.add(pack.name);
      out.push(pack);
    }
  }
  return out.sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.name.localeCompare(b.name));
}

function findPack(name, env = process.env) {
  return listPacks(env).find((p) => p.name === name && !p.error) || null;
}

function soundsFor(pack, category) {
  const own = pack.manifest.categories[category];
  if (own && own.sounds.length) return own.sounds;
  const alt = FALLBACK[category];
  return alt ? soundsFor(pack, alt) : [];
}

/** Random pick that avoids repeating the previous sound when there is a choice (CESP §sound selection). */
function pickSound(pack, category, lastKey, rand = Math.random) {
  const sounds = soundsFor(pack, category);
  if (!sounds.length) return null;
  const keyed = sounds.map((s) => ({ s, key: soundKey(s) }));
  const pool = keyed.length > 1 ? keyed.filter((k) => k.key !== lastKey) : keyed;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

function soundKey(s) {
  return s.file || crypto.createHash('sha1').update(JSON.stringify(s.tts || s.synth)).digest('hex').slice(0, 16);
}

/**
 * Turns a manifest sound into something the runner can play:
 * { kind: 'file', path } | { kind: 'tts', tts, out } | { kind: 'synth', synth, out }
 */
function resolveSound(pack, sound, env = process.env) {
  if (sound.file) {
    const p = path.resolve(pack.dir, sound.file);
    if (!p.startsWith(path.resolve(pack.dir) + path.sep)) return null; // path traversal in a third-party manifest
    return { kind: 'file', path: p, label: sound.label };
  }
  const kind = sound.tts ? 'tts' : 'synth';
  const out = path.join(cacheDir(env), kind, pack.name, soundKey(sound));
  return { kind, [kind]: sound[kind], out, label: sound.label };
}

module.exports = { BUILTIN_DIR, NAME_RE, validateManifest, loadPackDir, listPacks, findPack, soundsFor, pickSound, soundKey, resolveSound };
