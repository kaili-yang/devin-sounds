#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { CATEGORIES, configPath, loadConfig, saveConfig } = require('../lib/config');
const { listPacks, findPack, pickSound, resolveSound } = require('../lib/packs');
const { ensureAudio, playSource, sayVoices } = require('../lib/render');
const { onPath, playerCommand } = require('../lib/player');
const install = require('../lib/install');
const registry = require('../lib/registry');

const ROOT = path.join(__dirname, '..');

const HELP = `devin-sounds — voice lines and chimes for Devin

Usage: devin-sounds <command> [args]

  list                     installed packs (* = current)
  use <pack>               switch pack (and pre-render its voice lines)
  warm [pack]              pre-render a pack's voice lines and chimes
  preview [pack] [cat]     play one sound (default: current pack, task.complete)
  test [pack]              play every category of a pack
  search [query]           search the OpenPeon registry (370+ packs)
  add <name|dir>           install a pack from the registry or a local CESP folder
  remove <pack>            uninstall a pack you added
  volume <0..1>            set volume
  mute | unmute            turn all sounds off / on
  notify on|off            also show a desktop notification
  category <cat> on|off    enable or disable one category
  status                   config, player, TTS and hook status
  install [--project]      register hooks without the plugin system (user config, or <cwd>/.devin)
  uninstall [--project]    remove those hooks
  print-hooks              print the hooks JSON to paste by hand

Categories: ${CATEGORIES.join(', ')}`;

function fail(msg) {
  process.stderr.write(`devin-sounds: ${msg}\n`);
  process.exit(1);
}

function playOne(pack, category, cfg) {
  const pick = pickSound(pack, category, undefined);
  if (!pick) return console.log(`  ${category.padEnd(17)} (no sound)`);
  const source = resolveSound(pack, pick.s);
  const r = playSource(source, { volume: cfg.volume });
  console.log(`  ${category.padEnd(17)} ${pick.s.label || pick.key}${r.played ? '' : `  [${r.reason || 'failed'}]`}`);
}

/** Pre-renders every TTS / synth sound so the first real event plays instantly. */
function warm(pack) {
  const sounds = Object.values(pack.manifest.categories).flatMap((c) => c.sounds).filter((s) => !s.file);
  if (!sounds.length) return;
  process.stdout.write(`preparing ${sounds.length} sounds`);
  let ok = 0;
  for (const s of sounds) {
    if (ensureAudio(resolveSound(pack, s))) ok++;
    process.stdout.write('.');
  }
  console.log(ok === sounds.length ? ' done' : ` ${sounds.length - ok} could not be rendered (no TTS engine? chimes are used instead)`);
}

function requirePack(name) {
  const pack = findPack(name);
  if (!pack) fail(`no pack "${name}" — see \`devin-sounds list\``);
  return pack;
}

async function main(argv) {
  const [cmd, ...args] = argv;
  const cfg = loadConfig();
  switch (cmd) {
    case undefined: case 'help': case '-h': case '--help':
      return console.log(HELP);
    case 'list':
      for (const p of listPacks()) {
        const mark = p.name === cfg.pack ? '*' : ' ';
        console.log(p.error ? `  ${p.name}  (broken: ${p.error})` : `${mark} ${p.name.padEnd(20)} ${p.displayName}${p.builtin ? '' : '  [added]'}`);
      }
      return;
    case 'use': {
      const pack = requirePack(args[0] || fail('usage: devin-sounds use <pack>'));
      saveConfig({ pack: pack.name });
      console.log(`now using ${pack.name} (${pack.displayName})`);
      return warm(pack);
    }
    case 'warm':
      return warm(requirePack(args[0] || cfg.pack));
    case 'preview': {
      const pack = requirePack(args[0] || cfg.pack);
      const cat = args[1] || 'task.complete';
      if (!CATEGORIES.includes(cat)) fail(`unknown category "${cat}"`);
      return playOne(pack, cat, cfg);
    }
    case 'test': {
      const pack = requirePack(args[0] || cfg.pack);
      console.log(`${pack.name} — ${pack.displayName}`);
      for (const cat of CATEGORIES) playOne(pack, cat, cfg);
      return;
    }
    case 'search': {
      const hits = registry.search(await registry.fetchIndex(), args.join(' '));
      for (const p of hits.slice(0, 50)) console.log(`${p.name.padEnd(28)} ${(p.language || '').padEnd(6)} ${p.display_name}`);
      console.log(`\n${hits.length} pack(s). Install one with \`devin-sounds add <name>\`.`);
      return;
    }
    case 'add': {
      const src = args[0] || fail('usage: devin-sounds add <registry-name|folder>');
      const pack = /[\\/]|^\./.test(src) ? registry.installFromDir(src) : await registry.installFromRegistry(src);
      return console.log(`installed ${pack.name} (${pack.displayName}). Switch with \`devin-sounds use ${pack.name}\`.`);
    }
    case 'remove':
      return console.log(registry.removePack(args[0] || fail('usage: devin-sounds remove <pack>')) ? 'removed' : 'not an added pack');
    case 'volume': {
      const v = Number(args[0]);
      if (!(v >= 0 && v <= 1)) fail('volume must be between 0 and 1');
      saveConfig({ volume: v });
      return console.log(`volume ${v}`);
    }
    case 'mute': saveConfig({ enabled: false }); return console.log('muted');
    case 'unmute': saveConfig({ enabled: true }); return console.log('unmuted');
    case 'notify':
      if (!['on', 'off'].includes(args[0])) fail('usage: devin-sounds notify on|off');
      saveConfig({ notify: args[0] === 'on' });
      return console.log(`notifications ${args[0]}`);
    case 'category':
      if (!CATEGORIES.includes(args[0]) || !['on', 'off'].includes(args[1])) fail('usage: devin-sounds category <category> on|off');
      saveConfig({ categories: { [args[0]]: args[1] === 'on' } });
      return console.log(`${args[0]} ${args[1]}`);
    case 'status': {
      const probe = playerCommand('/tmp/x.wav', cfg.volume);
      const tts = process.platform === 'darwin' ? (sayVoices().length ? 'say' : 'say (no voices?)') : onPath('espeak-ng') ? 'espeak-ng' : onPath('espeak') ? 'espeak' : 'none (voice packs fall back to chimes)';
      console.log(`config     ${configPath()}`);
      console.log(`enabled    ${cfg.enabled}`);
      console.log(`pack       ${cfg.pack}${findPack(cfg.pack) ? '' : '  (missing — chime is used)'}`);
      console.log(`volume     ${cfg.volume}`);
      console.log(`notify     ${cfg.notify}`);
      console.log(`player     ${probe ? probe[0] : 'none found — install pulseaudio-utils, pipewire or ffmpeg'}`);
      console.log(`tts        ${tts}`);
      console.log(`hooks      user config: ${install.installed() ? 'yes' : 'no'}, this project: ${install.installed({ project: process.cwd() }) ? 'yes' : 'no'} (the plugin registers its own)`);
      return;
    }
    case 'install': case 'uninstall': {
      const project = args.includes('--project') ? process.cwd() : undefined;
      const r = install.apply({ pluginRoot: cmd === 'install' ? ROOT : null, project });
      return console.log(`${cmd === 'install' ? 'registered hooks in' : 'removed hooks from'} ${r.target}${cmd === 'install' ? '\nRestart Devin, then check with /hooks.' : ''}`);
    }
    case 'print-hooks':
      return console.log(JSON.stringify(install.withOurHooks({}, ROOT), null, 2));
    default:
      fail(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((e) => fail(e.message));
