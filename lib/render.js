'use strict';
// Makes sure a resolved sound exists on disk (rendering chimes / speaking TTS lines
// on first use, then caching them) and plays it.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { cacheDir, readJson, writeJsonAtomic } = require('./config');
const { renderWav } = require('./synth');
const { parseSayVoices, playerCommand, ttsCommand, onPath } = require('./player');

const VOICE_CACHE_MS = 7 * 24 * 3600 * 1000;

function sayVoices(env = process.env, platform = process.platform) {
  if (platform !== 'darwin') return [];
  const file = path.join(cacheDir(env), 'voices.json');
  const cached = readJson(file);
  if (cached && Date.now() - cached.at < VOICE_CACHE_MS && Array.isArray(cached.voices)) return cached.voices;
  const r = spawnSync('say', ['-v', '?'], { encoding: 'utf8', timeout: 5000 });
  const voices = r.status === 0 ? parseSayVoices(r.stdout) : [];
  if (voices.length) writeJsonAtomic(file, { at: Date.now(), voices });
  return voices;
}

function existing(base, exts) {
  for (const ext of exts) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}

/** @returns {string|null} path of a playable audio file */
function ensureAudio(source, { env = process.env, platform = process.platform, has = onPath, run = spawnSync } = {}) {
  if (!source) return null;
  if (source.kind === 'file') return fs.existsSync(source.path) ? source.path : null;
  if (source.kind === 'synth') {
    const out = `${source.out}.wav`;
    if (!fs.existsSync(out)) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const tmp = `${out}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, renderWav(source.synth));
      fs.renameSync(tmp, out);
    }
    return out;
  }
  if (source.kind === 'tts') {
    const hit = existing(source.out, ['.aiff', '.wav']);
    if (hit) return hit;
    const cmd = ttsCommand(source.tts, `${source.out}.${process.pid}.tmp`, { platform, has, sayVoices: sayVoices(env, platform) });
    if (!cmd) return null;
    fs.mkdirSync(path.dirname(source.out), { recursive: true });
    const r = run(cmd.argv[0], cmd.argv[1], { stdio: 'ignore', timeout: 15000 });
    if (r.status !== 0 || !fs.existsSync(cmd.out)) return null;
    const final = source.out + path.extname(cmd.out);
    fs.renameSync(cmd.out, final);
    return final;
  }
  return null;
}

function notify(title, message, { platform = process.platform, has = onPath, run = spawnSync } = {}) {
  if (!message) return;
  if (platform === 'darwin') {
    run('osascript', ['-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', title, message], { stdio: 'ignore', timeout: 5000 });
  } else if (platform === 'linux' && has('notify-send')) {
    run('notify-send', ['-a', 'Devin', title, message], { stdio: 'ignore', timeout: 5000 });
  }
}

/** Renders if needed, then plays synchronously. Returns what happened, for `doctor` and tests. */
function playSource(source, { volume = 0.6, notifyTitle, fallback, env, platform = process.platform, has = onPath, run = spawnSync } = {}) {
  // No TTS engine (e.g. Linux without espeak-ng) or a missing file: fall back to the chime.
  const file = ensureAudio(source, { env, platform, has, run }) || ensureAudio(fallback, { env, platform, has, run });
  if (notifyTitle) notify(notifyTitle, source && source.label, { platform, has, run });
  if (!file) return { played: false, reason: 'no-audio' };
  const cmd = playerCommand(file, volume, platform, has);
  if (!cmd) return { played: false, reason: 'no-player', file };
  const r = run(cmd[0], cmd[1], { stdio: 'ignore', timeout: 30000 });
  return { played: r.status === 0, file, player: cmd[0] };
}

module.exports = { sayVoices, ensureAudio, playSource, notify };
