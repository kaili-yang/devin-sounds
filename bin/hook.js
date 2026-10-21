#!/usr/bin/env node
'use strict';
// Hook entry point. Devin pipes the lifecycle event as JSON on stdin. We never print
// anything and always exit 0, so a sound hook can never change what Devin does
// (a PermissionRequest hook that printed a decision would approve or block a tool).

const { spawn } = require('node:child_process');
const path = require('node:path');
const { planForHook } = require('../lib/dispatch');

const HOOK_TIMEOUT_MS = 1500;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  const timer = setTimeout(() => process.exit(0), HOOK_TIMEOUT_MS);
  timer.unref();
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;
    const plan = planForHook(JSON.parse(raw));
    if (!plan) return;
    if (process.env.DEVIN_SOUNDS_DRY_RUN === '1') {
      process.stderr.write(JSON.stringify(plan) + '\n');
      return;
    }
    const child = spawn(process.execPath, [path.join(__dirname, 'runner.js'), JSON.stringify(plan)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    // fail open: a broken sound must never break a session
  }
}

main().finally(() => process.exit(0));
