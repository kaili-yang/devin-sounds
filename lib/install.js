'use strict';
// Fallback for machines without `devin plugins install`: registers the hook directly,
// either user-wide (~/.config/devin/config.json, "hooks" key) or per project
// (<project>/.devin/hooks.v1.json, whole file). Idempotent and reversible: only entries
// carrying MARKER are touched, everything else is preserved.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PostToolUse', 'Stop', 'PostCompaction', 'SessionEnd'];
const MARKER = 'DEVIN_SOUNDS_HOOK=1';

function userConfigPath(env = process.env) {
  if (env.DEVIN_CONFIG_PATH) return env.DEVIN_CONFIG_PATH;
  if (process.platform === 'win32' && env.APPDATA) return path.join(env.APPDATA, 'devin', 'config.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'devin', 'config.json');
}

function hookCommand(pluginRoot) {
  const p = path.join(pluginRoot, 'bin', 'hook.js').split(path.sep).join('/');
  return `${MARKER} node "${p}"`;
}

const isOurs = (group) => Array.isArray(group && group.hooks) && group.hooks.some((h) => typeof h.command === 'string' && h.command.includes(MARKER));

/** Pure: returns `hooks` with our entries replaced (pluginRoot given) or removed (pluginRoot null). */
function withOurHooks(hooks, pluginRoot) {
  const out = {};
  for (const [event, groups] of Object.entries(hooks || {})) {
    if (!Array.isArray(groups)) { out[event] = groups; continue; }
    const kept = groups.filter((g) => !isOurs(g));
    if (kept.length) out[event] = kept;
  }
  if (pluginRoot) {
    const entry = { matcher: '', hooks: [{ type: 'command', command: hookCommand(pluginRoot), timeout: 5 }] };
    for (const ev of EVENTS) out[ev] = [...(out[ev] || []), entry];
  }
  return out;
}

function readDoc(file) {
  if (!fs.existsSync(file)) return { doc: {}, raw: null };
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return { doc: JSON.parse(raw), raw };
  } catch {
    throw new Error(`${file} is not plain JSON (comments?); add the hooks by hand — see \`devin-sounds print-hooks\``);
  }
}

/**
 * @param {{ pluginRoot?: string|null, project?: string, env?: object }} opts pluginRoot null = uninstall
 */
function apply({ pluginRoot, project, env = process.env }) {
  if (project) {
    const target = path.join(project, '.devin', 'hooks.v1.json');
    const { doc } = readDoc(target);
    const next = withOurHooks(doc, pluginRoot);
    if (Object.keys(next).length) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(next, null, 2) + '\n');
    } else if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
    return { target };
  }
  const target = userConfigPath(env);
  const { doc, raw } = readDoc(target);
  if (raw != null) fs.writeFileSync(`${target}.devin-sounds.bak`, raw);
  const hooks = withOurHooks(doc.hooks, pluginRoot);
  if (Object.keys(hooks).length) doc.hooks = hooks;
  else delete doc.hooks;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
  return { target };
}

function installed({ project, env = process.env } = {}) {
  try {
    const file = project ? path.join(project, '.devin', 'hooks.v1.json') : userConfigPath(env);
    const { doc } = readDoc(file);
    const hooks = project ? doc : doc.hooks || {};
    return Object.values(hooks).some((groups) => Array.isArray(groups) && groups.some(isOurs));
  } catch {
    return false;
  }
}

module.exports = { EVENTS, MARKER, userConfigPath, hookCommand, withOurHooks, apply, installed };
