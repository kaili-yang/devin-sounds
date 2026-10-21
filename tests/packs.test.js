'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { listPacks, findPack, pickSound, resolveSound, validateManifest, soundsFor } = require('../lib/packs');
const { tmpEnv, writePack } = require('./helpers');

const CORE = ['session.start', 'task.acknowledge', 'task.complete', 'task.error', 'input.required', 'resource.limit'];

test('built-in packs are valid and cover every CESP core category', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  const packs = listPacks(env);
  assert.deepEqual(packs.map((p) => p.name).sort(), ['butler', 'chime', 'dagong', 'guofeng']);
  for (const p of packs) {
    assert.equal(p.error, undefined, `${p.name}: ${p.error}`);
    for (const cat of CORE) assert.ok(soundsFor(p, cat).length, `${p.name} has no ${cat}`);
  }
});

test('pickSound never repeats the previous sound when there is a choice', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  const pack = findPack('dagong', env);
  let last;
  for (let i = 0; i < 50; i++) {
    const pick = pickSound(pack, 'task.acknowledge', last);
    assert.notEqual(pick.key, last);
    last = pick.key;
  }
});

test('user.spam falls back to task.acknowledge when a pack lacks it', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  writePack(path.join(env.DEVIN_SOUNDS_HOME, 'packs', 'mini'), {
    cesp_version: '1.0', name: 'mini', categories: { 'task.acknowledge': { sounds: [{ file: 'sounds/ok.wav' }] } },
  }, { 'sounds/ok.wav': 'x' });
  const pack = findPack('mini', env);
  assert.equal(pickSound(pack, 'user.spam').s.file, 'sounds/ok.wav');
  assert.equal(pickSound(pack, 'session.end'), null);
});

test('an added pack overrides a built-in pack of the same name', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  writePack(path.join(env.DEVIN_SOUNDS_HOME, 'packs', 'chime'), {
    cesp_version: '1.0', name: 'chime', display_name: 'Mine', categories: { 'task.complete': { sounds: [{ file: 'a.mp3' }] } },
  }, { 'a.mp3': 'x' });
  const p = findPack('chime', env);
  assert.equal(p.displayName, 'Mine');
  assert.equal(p.builtin, false);
});

test('file paths escaping the pack directory are rejected', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  const dir = path.join(env.DEVIN_SOUNDS_HOME, 'packs', 'evil');
  writePack(dir, { cesp_version: '1.0', name: 'evil', categories: { 'task.complete': { sounds: [{ file: '../../../etc/passwd' }] } } });
  const pack = findPack('evil', env);
  assert.equal(resolveSound(pack, pack.manifest.categories['task.complete'].sounds[0], env), null);
});

test('tts and synth sounds resolve to stable cache paths', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  const pack = findPack('guofeng', env);
  const s = pack.manifest.categories['task.complete'].sounds[0];
  const a = resolveSound(pack, s, env);
  assert.equal(a.kind, 'tts');
  assert.ok(a.out.startsWith(path.join(env.DEVIN_SOUNDS_CACHE, 'tts', 'guofeng')));
  assert.equal(resolveSound(pack, s, env).out, a.out);
  const chime = findPack('chime', env);
  assert.equal(resolveSound(chime, chime.manifest.categories['task.complete'].sounds[0], env).kind, 'synth');
});

test('validateManifest explains what is wrong', () => {
  assert.match(validateManifest(null), /not an object/);
  assert.match(validateManifest({ name: 'Bad Name', categories: {} }), /name/);
  assert.match(validateManifest({ name: 'x', categories: { a: {} } }), /sounds/);
  assert.match(validateManifest({ name: 'x', categories: { a: { sounds: [{}] } } }), /file/);
  assert.equal(validateManifest({ name: 'x', categories: { a: { sounds: [{ file: 'a.wav' }] } } }), null);
});
