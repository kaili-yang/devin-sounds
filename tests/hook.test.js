'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { planForHook } = require('../lib/dispatch');
const { ensureAudio, playSource } = require('../lib/render');
const { saveConfig } = require('../lib/config');
const { tmpEnv } = require('./helpers');

const HOOK = path.join(__dirname, '..', 'bin', 'hook.js');

function runHook(payload, env) {
  return spawnSync(process.execPath, [HOOK], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), env: { ...env, DEVIN_SOUNDS_DRY_RUN: '1' }, encoding: 'utf8' });
}

test('hook plans a sound, prints nothing on stdout and exits 0', (t) => {
  const { env, cleanup } = tmpEnv({ DEVIN_SOUNDS_PACK: 'royal' });
  t.after(cleanup);
  const r = runHook({ hook_event_name: 'PermissionRequest', tool_name: 'exec', tool_input: { command: 'ls' }, session_id: 's' }, env);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'a PermissionRequest hook must never print a decision');
  const plan = JSON.parse(r.stderr);
  assert.equal(plan.category, 'input.required');
  assert.equal(plan.pack, 'royal');
  assert.equal(plan.source.kind, 'tts');
  assert.equal(plan.fallback.kind, 'synth');
});

test('hook fails open on garbage, empty input and silent events', (t) => {
  const { env, cleanup } = tmpEnv();
  t.after(cleanup);
  for (const input of ['not json', '', JSON.stringify({ hook_event_name: 'PreToolUse' })]) {
    const r = runHook(input, env);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  }
});

test('a missing pack falls back to chime; mute stops everything', (t) => {
  const { env, cleanup } = tmpEnv({ DEVIN_SOUNDS_PACK: 'does-not-exist' });
  t.after(cleanup);
  assert.equal(planForHook({ hook_event_name: 'Stop' }, { env }).pack, 'chime');
  saveConfig({ enabled: false }, env);
  assert.equal(planForHook({ hook_event_name: 'Stop' }, { env: { ...env, DEVIN_SOUNDS_PACK: 'chime' } }), null);
});

test('throttle state persists across hook processes', (t) => {
  const { env, cleanup } = tmpEnv({ DEVIN_SOUNDS_PACK: 'chime' });
  t.after(cleanup);
  assert.ok(planForHook({ hook_event_name: 'SessionStart' }, { env, now: 1_000_000 }));
  assert.equal(planForHook({ hook_event_name: 'UserPromptSubmit' }, { env, now: 1_000_500 }), null);
  assert.ok(planForHook({ hook_event_name: 'UserPromptSubmit' }, { env, now: 1_005_000 }));
});

test('synth sounds render once to the cache', (t) => {
  const { env, cleanup } = tmpEnv({ DEVIN_SOUNDS_PACK: 'chime' });
  t.after(cleanup);
  const plan = planForHook({ hook_event_name: 'Stop' }, { env });
  const file = ensureAudio(plan.source, { env });
  assert.ok(file.endsWith('.wav') && fs.statSync(file).size > 1000);
  const mtime = fs.statSync(file).mtimeMs;
  assert.equal(ensureAudio(plan.source, { env }), file);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
});

test('tts renders through the engine, falls back to the chime when it fails', (t) => {
  const { env, cleanup } = tmpEnv({ DEVIN_SOUNDS_PACK: 'intern' });
  t.after(cleanup);
  const plan = planForHook({ hook_event_name: 'Stop' }, { env });
  const calls = [];
  const fakeRun = (cmd, args) => {
    calls.push(cmd);
    if (cmd === 'espeak-ng') fs.writeFileSync(args[args.indexOf('-w') + 1], 'RIFF');
    return { status: 0 };
  };
  const ok = playSource(plan.source, { env, platform: 'linux', has: (c) => ['espeak-ng', 'paplay'].includes(c), run: fakeRun, fallback: plan.fallback });
  assert.deepEqual(calls, ['espeak-ng', 'paplay']);
  assert.ok(ok.played && ok.file.endsWith('.wav') && ok.file.includes(`${path.sep}tts${path.sep}`));
  calls.length = 0;
  const plan2 = planForHook({ hook_event_name: 'PermissionRequest' }, { env });
  const fb = playSource(plan2.source, { env, platform: 'linux', has: (c) => c === 'paplay', run: fakeRun, fallback: plan2.fallback });
  assert.deepEqual(calls, ['paplay']);
  assert.ok(fb.file.includes(`${path.sep}synth${path.sep}`));
});
