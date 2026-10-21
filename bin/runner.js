#!/usr/bin/env node
'use strict';
// Detached worker started by hook.js: renders the sound if it is not cached yet, then plays it.

const { playSource } = require('../lib/render');

try {
  const plan = JSON.parse(process.argv[2] || 'null');
  if (plan && plan.source) playSource(plan.source, { volume: plan.volume, notifyTitle: plan.notifyTitle, fallback: plan.fallback });
} catch {
  // nothing to report to: the hook already returned
}
