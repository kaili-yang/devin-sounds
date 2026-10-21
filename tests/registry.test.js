'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry');
const { findPack } = require('../lib/packs');
const { tmpEnv, writePack } = require('./helpers');

const manifest = { cesp_version: '1.0', name: 'tiny', display_name: 'Tiny', categories: { 'task.complete': { sounds: [{ file: 'sounds/done.wav', label: 'done' }] } } };
const entry = (extra = {}) => ({ name: 'tiny', source_repo: 'someone/tiny-pack', source_ref: 'v1.0.0', source_path: 'tiny', ...extra });

test('tarballUrl only accepts well-formed registry entries', () => {
  assert.equal(registry.tarballUrl(entry()), 'https://codeload.github.com/someone/tiny-pack/tar.gz/v1.0.0');
  assert.throws(() => registry.tarballUrl(entry({ source_repo: 'evil.com/../x/y' })), /source_repo/);
  assert.throws(() => registry.tarballUrl(entry({ source_ref: '../../x' })), /source_ref/);
  assert.throws(() => registry.tarballUrl(entry({ name: '../x' })), /name/);
});

test('search matches name, title, language and tags', () => {
  const packs = [
    { name: 'peon', display_name: 'Orc Peon', language: 'en', tags: ['warcraft'] },
    { name: 'glados', display_name: 'GLaDOS', language: 'en', tags: ['portal'] },
  ];
  assert.deepEqual(registry.search(packs, 'warcraft').map((p) => p.name), ['peon']);
  assert.deepEqual(registry.search(packs, 'GLA').map((p) => p.name), ['glados']);
  assert.equal(registry.search(packs, '').length, 2);
});

test('installFromDir copies a CESP folder and verifies the checksum', (t) => {
  const { root, env, cleanup } = tmpEnv();
  t.after(cleanup);
  const src = path.join(root, 'src', 'tiny');
  writePack(src, manifest, { 'sounds/done.wav': 'RIFF' });
  const pack = registry.installFromDir(src, { env });
  assert.equal(pack.name, 'tiny');
  assert.ok(findPack('tiny', env));
  assert.throws(() => registry.installFromDir(src, { env, expectedSha: 'deadbeef' }), /checksum/);
  assert.ok(registry.removePack('tiny', env));
  assert.equal(findPack('tiny', env), null);
});

test('installFromRegistry downloads, extracts and installs a pack', { skip: spawnSync('tar', ['--version']).status !== 0 && 'tar not available' }, async (t) => {
  const { root, env, cleanup } = tmpEnv();
  t.after(cleanup);
  const repoDir = path.join(root, 'build', 'tiny-pack-1.0.0');
  writePack(path.join(repoDir, 'tiny'), manifest, { 'sounds/done.wav': 'RIFF' });
  const tgz = path.join(root, 'pack.tgz');
  assert.equal(spawnSync('tar', ['-czf', tgz, '-C', path.join(root, 'build'), 'tiny-pack-1.0.0']).status, 0);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(repoDir, 'tiny', 'openpeon.json'))).digest('hex');
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const buf = fs.readFileSync(tgz);
    return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
  };
  const pack = await registry.installFromRegistry('tiny', { env, fetchImpl, packs: [entry({ manifest_sha256: sha })] });
  assert.equal(pack.name, 'tiny');
  assert.deepEqual(requested, ['https://codeload.github.com/someone/tiny-pack/tar.gz/v1.0.0']);
  assert.ok(fs.existsSync(path.join(env.DEVIN_SOUNDS_HOME, 'packs', 'tiny', 'sounds', 'done.wav')));
  await assert.rejects(registry.installFromRegistry('nope', { env, fetchImpl, packs: [] }), /no pack named/);
});
