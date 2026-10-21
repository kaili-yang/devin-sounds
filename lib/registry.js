'use strict';
// Installs packs from the OpenPeon registry (the peon-ping pack catalog) or a local folder.

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { userPacksDir } = require('./config');
const { NAME_RE, loadPackDir } = require('./packs');

const INDEX_URL = 'https://peonping.github.io/registry/index.json';
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_RE = /^[A-Za-z0-9_./-]+$/;

async function fetchIndex(fetchImpl = fetch) {
  const res = await fetchImpl(INDEX_URL);
  if (!res.ok) throw new Error(`registry index: HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body.packs) ? body.packs : [];
}

function search(packs, query = '') {
  const q = query.toLowerCase();
  return packs.filter((p) => !q || [p.name, p.display_name, p.description, p.language, ...(p.tags || [])]
    .some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
}

/** Validates a registry entry before any of its fields reach a URL or a path. */
function tarballUrl(entry) {
  if (!entry || !NAME_RE.test(entry.name || '')) throw new Error('registry entry has an invalid name');
  if (!REPO_RE.test(entry.source_repo || '')) throw new Error(`invalid source_repo for ${entry.name}`);
  if (!REF_RE.test(entry.source_ref || '') || entry.source_ref.includes('..')) throw new Error(`invalid source_ref for ${entry.name}`);
  return `https://codeload.github.com/${entry.source_repo}/tar.gz/${entry.source_ref}`;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Copies a CESP pack directory into the user packs dir; returns the installed pack. */
function installFromDir(dir, { env = process.env, expectedSha } = {}) {
  const pack = loadPackDir(path.resolve(dir), false);
  if (pack.error) throw new Error(`${dir}: ${pack.error}`);
  if (expectedSha && sha256(path.join(dir, 'openpeon.json')) !== expectedSha) throw new Error(`${pack.name}: manifest checksum mismatch`);
  const dest = path.join(userPacksDir(env), pack.name);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(dir, dest, { recursive: true, filter: (src) => !src.split(path.sep).includes('.git') });
  return loadPackDir(dest, false);
}

async function installFromRegistry(name, { env = process.env, fetchImpl = fetch, packs } = {}) {
  const entry = (packs || (await fetchIndex(fetchImpl))).find((p) => p.name === name);
  if (!entry) throw new Error(`no pack named "${name}" in the OpenPeon registry (try \`devin-sounds search\`)`);
  const res = await fetchImpl(tarballUrl(entry));
  if (!res.ok) throw new Error(`download ${entry.source_repo}@${entry.source_ref}: HTTP ${res.status}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-sounds-'));
  try {
    const tgz = path.join(tmp, 'pack.tgz');
    fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
    const r = spawnSync('tar', ['-xzf', tgz, '-C', tmp], { stdio: 'ignore' });
    if (r.status !== 0) throw new Error('could not extract the pack archive (is `tar` installed?)');
    const top = fs.readdirSync(tmp, { withFileTypes: true }).find((e) => e.isDirectory());
    if (!top) throw new Error('empty pack archive');
    const root = path.resolve(tmp, top.name);
    const dir = path.resolve(root, entry.source_path || '.');
    if (dir !== root && !dir.startsWith(root + path.sep)) throw new Error(`invalid source_path for ${name}`);
    return installFromDir(dir, { env, expectedSha: entry.manifest_sha256 });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function removePack(name, env = process.env) {
  if (!NAME_RE.test(name)) throw new Error(`invalid pack name "${name}"`);
  const dest = path.join(userPacksDir(env), name);
  if (!fs.existsSync(dest)) return false;
  fs.rmSync(dest, { recursive: true, force: true });
  return true;
}

module.exports = { INDEX_URL, fetchIndex, search, tarballUrl, installFromDir, installFromRegistry, removePack };
