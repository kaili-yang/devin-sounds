'use strict';
// Throttle state shared by all sessions: last play time per category, last file per
// category (to avoid repeats) and recent prompt times (spam detection).

const path = require('node:path');
const { cacheDir, readJson, writeJsonAtomic } = require('./config');

const statePath = (env) => path.join(cacheDir(env), 'state.json');

function loadState(env = process.env) {
  return readJson(statePath(env)) || {};
}

function saveState(state, env = process.env) {
  try { writeJsonAtomic(statePath(env), state); } catch { /* best effort */ }
}

module.exports = { statePath, loadState, saveState };
