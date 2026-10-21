'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Isolated config/cache dirs for one test. */
function tmpEnv(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-sounds-test-'));
  return {
    root,
    env: { ...process.env, DEVIN_SOUNDS_HOME: path.join(root, 'config'), DEVIN_SOUNDS_CACHE: path.join(root, 'cache'), DEVIN_CONFIG_PATH: path.join(root, 'devin', 'config.json'), ...extra },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function writePack(dir, manifest, files = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'openpeon.json'), JSON.stringify(manifest));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
}

module.exports = { tmpEnv, writePack };
