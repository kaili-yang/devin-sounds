'use strict';
// Hook event -> play plan. The hook process only plans (fast); a detached runner
// renders and plays, so Devin never waits on audio.

const { loadConfig } = require('./config');
const { decide } = require('./events');
const { findPack, pickSound, resolveSound } = require('./packs');
const { loadState, saveState } = require('./state');

const FALLBACK_PACK = 'chime';

function fallbackSource(pack, category, env) {
  if (pack.name === FALLBACK_PACK) return undefined;
  const chime = findPack(FALLBACK_PACK, env);
  const pick = chime && pickSound(chime, category, undefined, () => 0);
  return pick ? resolveSound(chime, pick.s, env) : undefined;
}

/** @returns {null | { category, pack, source, fallback, volume, notifyTitle }} */
function planForHook(payload, { env = process.env, now = Date.now(), rand = Math.random } = {}) {
  const config = loadConfig(env);
  const prev = loadState(env);
  const d = decide(payload, prev, config, now);
  let plan = null;
  if (d.category) {
    const pack = findPack(config.pack, env) || findPack(FALLBACK_PACK, env);
    const pick = pack && pickSound(pack, d.category, (d.state.lastFile || {})[d.category], rand);
    if (pick) {
      d.state.lastFile = { ...(d.state.lastFile || {}), [d.category]: pick.key };
      plan = {
        category: d.category,
        pack: pack.name,
        source: resolveSound(pack, pick.s, env),
        fallback: fallbackSource(pack, d.category, env),
        volume: config.volume,
        notifyTitle: config.notify ? 'Devin' : undefined,
      };
    }
  }
  saveState(d.state, env);
  return plan && plan.source ? plan : null;
}

module.exports = { planForHook, FALLBACK_PACK };
