#!/usr/bin/env node
'use strict';
// Renders the README audio samples (docs/samples/*.mp3) and the GitHub Pages player
// (docs/index.html) from the built-in packs. Needs macOS `say` and ffmpeg.
//
//   node scripts/render-samples.js

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findPack, soundsFor, resolveSound } = require('../lib/packs');
const { ensureAudio } = require('../lib/render');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'samples');
const PACKS = ['butler', 'royal', 'intern', 'chime'];
const CATEGORIES = [
  ['session.start', 'Session starts'],
  ['task.acknowledge', 'You send a prompt'],
  ['input.required', 'Devin needs your approval'],
  ['task.error', 'A tool fails'],
  ['task.complete', 'Devin finishes'],
];

const env = { ...process.env, DEVIN_SOUNDS_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'ds-home-')), DEVIN_SOUNDS_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'ds-cache-')) };
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rows = [];
for (const name of PACKS) {
  const pack = findPack(name, env);
  if (!pack) throw new Error(`missing pack ${name}`);
  const items = [];
  for (const [cat, when] of CATEGORIES) {
    const sound = soundsFor(pack, cat)[0];
    const src = ensureAudio(resolveSound(pack, sound, env), { env });
    if (!src) throw new Error(`could not render ${name}/${cat} (macOS say needed)`);
    const file = `${name}-${cat.replace('.', '-')}.mp3`;
    // pad 0.15 s of silence at both ends so browsers do not clip the first syllable
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', 'adelay=150|150,apad=pad_dur=0.15,loudnorm=I=-16:TP=-1.5', '-ac', '1', '-ar', '44100', '-b:a', '96k', path.join(OUT, file)]);
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${r.stderr}`);
    items.push({ cat, when, label: sound.label, file });
    console.log(`${file}  ${sound.label}`);
  }
  rows.push({ name, display: pack.displayName, items });
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>devin-sounds · samples</title>
<style>
  body{margin:0;background:#0f0d1a;color:#ece9ff;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:880px;margin:0 auto;padding:40px 20px 60px}
  h1{margin:0 0 6px;font-size:28px} p.sub{color:#9a94bf;margin:0 0 28px}
  code{background:#221f36;padding:2px 6px;border-radius:6px}
  section{background:#1a1730;border:1px solid #2e2a47;border-radius:16px;padding:18px 20px;margin-bottom:18px}
  h2{margin:0 0 12px;font-size:18px} h2 small{color:#9a94bf;font-weight:500;margin-left:8px}
  .row{display:grid;grid-template-columns:200px 1fr 260px;gap:12px;align-items:center;padding:8px 0;border-top:1px solid #26223d}
  .row:first-of-type{border-top:0} .when{color:#9a94bf;font-size:13px} .line{font-weight:600}
  audio{width:100%;height:34px}
  @media (max-width:700px){.row{grid-template-columns:1fr}}
</style></head>
<body><main>
<h1>devin-sounds</h1>
<p class="sub">What Devin sounds like with each built-in pack. Install: <code>devin plugins install kaili-yang/devin-sounds</code> ·
<a href="https://github.com/kaili-yang/devin-sounds" style="color:#2ee6c5">GitHub</a></p>
${rows.map((p) => `<section><h2><code>${p.name}</code><small>${esc(p.display)}</small></h2>
${p.items.map((i) => `<div class="row"><div class="when">${esc(i.when)}</div><div class="line">${esc(i.label)}</div><audio controls preload="none" src="samples/${i.file}"></audio></div>`).join('\n')}
</section>`).join('\n')}
<p class="sub">Voice packs are spoken by the listener's own text-to-speech at runtime; these recordings were made with macOS <code>say</code>.</p>
</main></body></html>
`;
fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(rows, null, 2) + '\n');
console.log('wrote docs/index.html');
