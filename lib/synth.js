'use strict';
// Tiny chime synthesizer: notes -> 16-bit mono PCM WAV. No audio files to license.

const SAMPLE_RATE = 22050;
const NOTE_RE = /^([A-G])(#|b)?(\d)$/;
const SEMITONE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** "A4" -> 440, "C#5" -> 554.37; numbers pass through; "rest" -> 0. */
function frequency(note) {
  if (typeof note === 'number') return note;
  if (note === 'rest') return 0;
  const m = NOTE_RE.exec(note);
  if (!m) throw new Error(`bad note "${note}"`);
  const n = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (n / 12);
}

/**
 * @param {{ notes: Array<{ n: string|number, ms: number, gain?: number }>, overlapMs?: number }} spec
 * Each note is a bell-like tone (fundamental + soft octave) with a fast attack and exponential decay.
 * Notes start every `ms` but ring for `ms + overlapMs`, so arpeggios blend.
 */
function renderWav(spec, sampleRate = SAMPLE_RATE) {
  const overlap = spec.overlapMs ?? 120;
  let t0 = 0;
  const voices = spec.notes.map((note) => {
    const v = { f: frequency(note.n), start: t0, len: note.ms + overlap, gain: note.gain ?? 0.5 };
    t0 += note.ms;
    return v;
  });
  const totalMs = Math.max(...voices.map((v) => v.start + v.len));
  const total = Math.ceil((totalMs / 1000) * sampleRate);
  const mix = new Float32Array(total);
  for (const v of voices) {
    if (!v.f) continue;
    const s0 = Math.floor((v.start / 1000) * sampleRate);
    const n = Math.floor((v.len / 1000) * sampleRate);
    const decay = 5 / n;
    for (let i = 0; i < n && s0 + i < total; i++) {
      const env = Math.min(1, i / (0.004 * sampleRate)) * Math.exp(-decay * i);
      const ph = (2 * Math.PI * v.f * i) / sampleRate;
      mix[s0 + i] += v.gain * env * (Math.sin(ph) + 0.25 * Math.sin(2 * ph));
    }
  }
  let peak = 0;
  for (const x of mix) peak = Math.max(peak, Math.abs(x));
  const scale = peak > 0.95 ? 0.95 / peak : 1;
  const data = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) data.writeInt16LE(Math.round(mix[i] * scale * 32767), i * 2);
  return Buffer.concat([wavHeader(data.length, sampleRate), data]);
}

function wavHeader(dataLen, sampleRate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataLen, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(dataLen, 40);
  return h;
}

module.exports = { SAMPLE_RATE, frequency, renderWav };
