'use strict';
// Picks a command-line audio player and a TTS engine for the current platform.

const fs = require('node:fs');
const path = require('node:path');

/** True when `cmd` is an executable on PATH (no subprocess, so it is cheap inside a hook). */
function onPath(cmd, env = process.env) {
  const exts = process.platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      try {
        fs.accessSync(path.join(dir, cmd + ext), fs.constants.X_OK);
        return true;
      } catch { /* keep looking */ }
    }
  }
  return false;
}

/** @returns {[string, string[]] | null} argv that plays `file` at `volume` (0..1). */
function playerCommand(file, volume, platform = process.platform, has = onPath) {
  const v = Math.min(1, Math.max(0, volume));
  const ext = path.extname(file).toLowerCase();
  if (platform === 'darwin') return ['afplay', ['-v', v.toFixed(2), file]];
  if (platform === 'win32') {
    const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const ps = `Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; `
      + `$p.Open([uri]${lit(file)}); $p.Volume = ${v.toFixed(2)}; $p.Play(); `
      + `while (-not $p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 50 }; `
      + `Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 100)`;
    return ['powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]];
  }
  if (ext === '.wav' && has('paplay')) return ['paplay', [`--volume=${Math.round(v * 65536)}`, file]];
  if (has('pw-play')) return ['pw-play', ['--volume', v.toFixed(2), file]];
  if (has('ffplay')) return ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(Math.round(v * 100)), file]];
  if (ext === '.mp3' && has('mpg123')) return ['mpg123', ['-q', '-f', String(Math.round(v * 32768)), file]];
  if (ext === '.wav' && has('aplay')) return ['aplay', ['-q', file]];
  return null;
}

/** Parses `say -v '?'` output into [{ name, lang }]. Names may contain spaces and parentheses. */
function parseSayVoices(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^(.+?)\s+([a-z]{2}_[A-Z0-9]{2,3})\s+#/.exec(line);
    if (m) out.push({ name: m[1].trim(), lang: m[2] });
  }
  return out;
}

/** First preferred voice that exists, else any voice for the language, else null. */
function chooseVoice(voices, prefs = [], lang) {
  for (const want of prefs) {
    const hit = voices.find((v) => (v.name === want || v.name.startsWith(`${want} (`)) && (!lang || v.lang === lang));
    if (hit) return hit.name;
  }
  const byLang = lang && voices.find((v) => v.lang === lang);
  return byLang ? byLang.name : null;
}

/**
 * @param {{ text: string, lang?: string, voices?: string[], rate?: number }} tts
 * @param {string} outBase output path without extension
 * @returns {{ argv: [string, string[]], out: string } | null}
 */
function ttsCommand(tts, outBase, { platform = process.platform, has = onPath, sayVoices = [] } = {}) {
  if (platform === 'darwin') {
    const voice = chooseVoice(sayVoices, tts.voices, tts.lang);
    const out = `${outBase}.aiff`;
    const args = [...(voice ? ['-v', voice] : []), ...(tts.rate ? ['-r', String(tts.rate)] : []), '-o', out, '--', tts.text];
    return { argv: ['say', args], out };
  }
  const engine = has('espeak-ng') ? 'espeak-ng' : has('espeak') ? 'espeak' : null;
  if (!engine) return null;
  const out = `${outBase}.wav`;
  const lang = (tts.lang || 'en').split('_')[0];
  return { argv: [engine, ['-v', lang, '-w', out, tts.text]], out };
}

module.exports = { onPath, playerCommand, parseSayVoices, chooseVoice, ttsCommand };
