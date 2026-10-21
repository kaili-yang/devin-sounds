'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { categorize, decide } = require('../lib/events');
const { defaults } = require('../lib/config');

const cfg = () => ({ ...defaults(), minGapSec: 1.5, errorCooldownSec: 20 });

test('maps every Devin hook event to a CESP category', () => {
  const cases = [
    [{ hook_event_name: 'SessionStart', source: 'startup' }, 'session.start'],
    [{ hook_event_name: 'UserPromptSubmit', prompt: 'hi' }, 'task.acknowledge'],
    [{ hook_event_name: 'PermissionRequest', tool_name: 'exec' }, 'input.required'],
    [{ hook_event_name: 'Stop', stop_hook_active: false }, 'task.complete'],
    [{ hook_event_name: 'PostToolUse', tool_response: { success: false, output: '', error: 'boom' } }, 'task.error'],
    [{ hook_event_name: 'PostCompaction', summary: 's' }, 'resource.limit'],
    [{ hook_event_name: 'SessionEnd', reason: 'exit' }, 'session.end'],
  ];
  for (const [payload, want] of cases) assert.equal(categorize(payload, {}, 0), want, payload.hook_event_name);
});

test('successful tools, unknown events and re-entrant stops are silent', () => {
  assert.equal(categorize({ hook_event_name: 'PostToolUse', tool_response: { success: true, error: null } }, {}, 0), null);
  assert.equal(categorize({ hook_event_name: 'PreToolUse' }, {}, 0), null);
  assert.equal(categorize({ hook_event_name: 'Stop', stop_hook_active: true }, {}, 0), null);
  assert.equal(categorize(null, {}, 0), null);
});

test('three prompts within 10 s is user.spam', () => {
  let state = {};
  const cats = [];
  for (const t of [0, 3000, 6000]) {
    const d = decide({ hook_event_name: 'UserPromptSubmit' }, state, cfg(), 100_000 + t);
    cats.push(d.category);
    state = d.state;
  }
  assert.deepEqual(cats, ['task.acknowledge', 'task.acknowledge', 'user.spam']);
  // old prompts age out of the window
  const later = decide({ hook_event_name: 'UserPromptSubmit' }, state, cfg(), 100_000 + 30_000);
  assert.equal(later.category, 'task.acknowledge');
});

test('min gap drops low-priority sounds but never approvals or completions', () => {
  const first = decide({ hook_event_name: 'SessionStart' }, {}, cfg(), 10_000);
  assert.equal(first.category, 'session.start');
  const ack = decide({ hook_event_name: 'UserPromptSubmit' }, first.state, cfg(), 10_500);
  assert.equal(ack.category, null);
  assert.equal(ack.reason, 'min-gap');
  assert.equal(decide({ hook_event_name: 'PermissionRequest' }, first.state, cfg(), 10_500).category, 'input.required');
  assert.equal(decide({ hook_event_name: 'Stop' }, first.state, cfg(), 10_500).category, 'task.complete');
});

test('errors are rate limited by errorCooldownSec', () => {
  const fail = { hook_event_name: 'PostToolUse', tool_response: { success: false } };
  const a = decide(fail, {}, cfg(), 50_000);
  assert.equal(a.category, 'task.error');
  assert.equal(decide(fail, a.state, cfg(), 60_000).reason, 'error-cooldown');
  assert.equal(decide(fail, a.state, cfg(), 71_000).category, 'task.error');
});

test('mute and per-category switches', () => {
  assert.equal(decide({ hook_event_name: 'Stop' }, {}, { ...cfg(), enabled: false }, 0).reason, 'disabled');
  const c = cfg();
  c.categories['task.complete'] = false;
  assert.equal(decide({ hook_event_name: 'Stop' }, {}, c, 0).reason, 'category-off');
});
