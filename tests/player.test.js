'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { playerCommand, parseSayVoices, chooseVoice, ttsCommand } = require('../lib/player');
const { frequency, renderWav, SAMPLE_RATE } = require('../lib/synth');

const hasOnly = (...cmds) => (c) => cmds.includes(c);

test('macOS plays with afplay at the configured volume', () => {
  assert.deepEqual(playerCommand('/a b/x.aiff', 0.6, 'darwin'), ['afplay', ['-v', '0.60', '/a b/x.aiff']]);
  assert.deepEqual(playerCommand('/x.wav', 7, 'darwin')[1].slice(0, 2), ['-v', '1.00']);
});

test('Linux picks the first available player that handles the format', () => {
  assert.equal(playerCommand('/x.wav', 0.5, 'linux', hasOnly('paplay', 'ffplay'))[0], 'paplay');
  assert.equal(playerCommand('/x.mp3', 0.5, 'linux', hasOnly('paplay', 'ffplay'))[0], 'ffplay');
  assert.equal(playerCommand('/x.mp3', 0.5, 'linux', hasOnly('mpg123'))[0], 'mpg123');
  assert.equal(playerCommand('/x.wav', 0.5, 'linux', hasOnly('aplay'))[0], 'aplay');
  assert.equal(playerCommand('/x.mp3', 0.5, 'linux', hasOnly('aplay')), null);
});

test('Windows quotes the path for PowerShell', () => {
  const [cmd, args] = playerCommand("C:\\it's\\x.wav", 0.5, 'win32');
  assert.equal(cmd, 'powershell');
  assert.match(args.at(-1), /\[uri\]'C:\\it''s\\x\.wav'/);
});

test('parses `say -v ?` including names with spaces and parentheses', () => {
  const voices = parseSayVoices([
    'Samantha            en_US    # Hello! My name is Samantha.',
    'Grandpa (English (UK)) en_GB    # Hello! My name is Grandpa.',
    'Daniel              en_GB    # Hello! My name is Daniel.',
    'garbage line',
  ].join('\n'));
  assert.deepEqual(voices, [
    { name: 'Samantha', lang: 'en_US' },
    { name: 'Grandpa (English (UK))', lang: 'en_GB' },
    { name: 'Daniel', lang: 'en_GB' },
  ]);
  assert.equal(chooseVoice(voices, ['Grandpa'], 'en_GB'), 'Grandpa (English (UK))');
  assert.equal(chooseVoice(voices, ['Nobody', 'Daniel'], 'en_GB'), 'Daniel');
  assert.equal(chooseVoice(voices, ['Nobody'], 'en_GB'), 'Grandpa (English (UK))');
  assert.equal(chooseVoice(voices, ['Samantha'], 'en_GB'), 'Grandpa (English (UK))');
  assert.equal(chooseVoice(voices, [], 'fr_FR'), null);
});

test('ttsCommand uses say on macOS, espeak-ng on Linux, nothing otherwise', () => {
  const tts = { text: 'Done, boss!', lang: 'en_US', voices: ['Samantha'] };
  const mac = ttsCommand(tts, '/c/x', { platform: 'darwin', sayVoices: [{ name: 'Samantha', lang: 'en_US' }] });
  assert.deepEqual(mac, { argv: ['say', ['-v', 'Samantha', '-o', '/c/x.aiff', '--', tts.text]], out: '/c/x.aiff' });
  const linux = ttsCommand(tts, '/c/x', { platform: 'linux', has: hasOnly('espeak-ng') });
  assert.deepEqual(linux.argv, ['espeak-ng', ['-v', 'en', '-w', '/c/x.wav', tts.text]]);
  assert.equal(ttsCommand(tts, '/c/x', { platform: 'linux', has: hasOnly() }), null);
});

test('synth: note names and a well-formed WAV', () => {
  assert.equal(frequency('A4'), 440);
  assert.ok(Math.abs(frequency('C5') - 523.25) < 0.01);
  assert.ok(Math.abs(frequency('C#4') - 277.18) < 0.01);
  assert.equal(frequency('rest'), 0);
  assert.throws(() => frequency('H2'));
  const wav = renderWav({ notes: [{ n: 'C5', ms: 100 }, { n: 'G5', ms: 100 }], overlapMs: 100 });
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  assert.equal(wav.length - 44, Math.ceil(0.3 * SAMPLE_RATE) * 2);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  assert.ok(peak > 1000 && peak <= 32767);
});
