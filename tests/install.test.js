'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { withOurHooks, apply, installed, EVENTS, MARKER } = require('../lib/install');
const { tmpEnv } = require('./helpers');

const other = { matcher: '', hooks: [{ type: 'command', command: 'sh /x/devin-remote-desktop-hook.sh Stop 3597', timeout: 3600 }] };

test('withOurHooks adds one entry per event and keeps other hooks', () => {
  const out = withOurHooks({ Stop: [other], Custom: 'weird' }, '/plug');
  assert.deepEqual(Object.keys(out).sort(), [...new Set([...EVENTS, 'Custom'])].sort());
  assert.equal(out.Stop.length, 2);
  assert.deepEqual(out.Stop[0], other);
  assert.match(out.Stop[1].hooks[0].command, new RegExp(`^${MARKER} node "/plug/bin/hook.js"$`));
  assert.deepEqual(withOurHooks(out, '/plug'), out, 'idempotent');
  assert.deepEqual(withOurHooks(out, null), { Stop: [other], Custom: 'weird' }, 'uninstall removes only ours');
});

test('user install preserves the rest of config.json and writes a backup', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  const file = env.DEVIN_CONFIG_PATH;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const original = { model: 'x', hooks: { Stop: [other] } };
  fs.writeFileSync(file, JSON.stringify(original));
  apply({ pluginRoot: '/plug', env });
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(doc.model, 'x');
  assert.equal(doc.hooks.Stop.length, 2);
  assert.ok(installed({ env }));
  assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.devin-sounds.bak`, 'utf8')), original);
  apply({ pluginRoot: null, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
  assert.ok(!installed({ env }));
});

test('refuses to rewrite a config that is not plain JSON', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  fs.mkdirSync(path.dirname(env.DEVIN_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(env.DEVIN_CONFIG_PATH, '{ // comment\n}');
  assert.throws(() => apply({ pluginRoot: '/plug', env }), /not plain JSON/);
});

test('project install writes .devin/hooks.v1.json and removes it when empty', (t) => {
  const { root, cleanup } = tmpEnv();
  t.after(cleanup);
  apply({ pluginRoot: '/plug', project: root });
  const file = path.join(root, '.devin', 'hooks.v1.json');
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), [...EVENTS].sort());
  assert.ok(installed({ project: root }));
  apply({ pluginRoot: null, project: root });
  assert.ok(!fs.existsSync(file));
});

test('plugin hooks.json registers the same events as the fallback installer', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(doc).sort(), [...EVENTS].sort());
  for (const ev of EVENTS) assert.match(doc[ev][0].hooks[0].command, /\$\{DEVIN_PLUGIN_ROOT\}\/bin\/hook\.js/);
});
