'use strict';
// Maps Devin hook events to CESP (OpenPeon) categories and applies throttling.
// Pure: takes the previous state and returns the next one, so it is fully testable.

const SPAM_WINDOW_MS = 10_000;
const SPAM_COUNT = 3;
// These always play, even right after another sound: missing them costs the user time.
const PRIORITY = new Set(['input.required', 'task.complete']);

function toolFailed(payload) {
  const r = payload.tool_response;
  return !!r && typeof r === 'object' && (r.success === false || (r.error != null && r.error !== ''));
}

/** Returns the CESP category for a hook payload, or null when nothing should play. */
function categorize(payload, state, now) {
  switch (payload && payload.hook_event_name) {
    case 'SessionStart': return 'session.start';
    case 'UserPromptSubmit': {
      const recent = (state.prompts || []).filter((t) => now - t < SPAM_WINDOW_MS);
      return recent.length + 1 >= SPAM_COUNT ? 'user.spam' : 'task.acknowledge';
    }
    case 'PermissionRequest': return 'input.required';
    case 'Stop': return payload.stop_hook_active ? null : 'task.complete';
    case 'PostToolUse': return toolFailed(payload) ? 'task.error' : null;
    case 'PostCompaction': return 'resource.limit';
    case 'SessionEnd': return 'session.end';
    default: return null;
  }
}

/**
 * Decides whether a hook event plays a sound.
 * @returns {{ category: string|null, state: object, reason?: string }}
 */
function decide(payload, prevState, config, now = Date.now()) {
  const state = { lastAt: 0, lastByCategory: {}, lastFile: {}, prompts: [], ...prevState };
  if (payload && payload.hook_event_name === 'UserPromptSubmit') {
    state.prompts = [...(state.prompts || []).filter((t) => now - t < SPAM_WINDOW_MS), now];
  }
  const category = categorize(payload, prevState || {}, now);
  if (!category) return { category: null, state, reason: 'no-category' };
  if (!config.enabled) return { category: null, state, reason: 'disabled' };
  if (config.categories && config.categories[category] === false) return { category: null, state, reason: 'category-off' };
  if (category === 'task.error' && now - (state.lastByCategory['task.error'] || 0) < config.errorCooldownSec * 1000) {
    return { category: null, state, reason: 'error-cooldown' };
  }
  if (!PRIORITY.has(category) && now - (state.lastAt || 0) < config.minGapSec * 1000) {
    return { category: null, state, reason: 'min-gap' };
  }
  return { category, state: { ...state, lastAt: now, lastByCategory: { ...state.lastByCategory, [category]: now } } };
}

module.exports = { categorize, decide, toolFailed, PRIORITY };
