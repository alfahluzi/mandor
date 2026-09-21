#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function configPath() {
  if (process.env.MANDOR_CONFIG) return path.resolve(process.env.MANDOR_CONFIG);
  return path.resolve(__dirname, '..', 'config.json');
}

function isValidEntry(entry) {
  return entry
    && typeof entry === 'object'
    && typeof entry.name === 'string'
    && entry.name.length > 0
    && typeof entry.path === 'string'
    && entry.path.length > 0;
}

function read() {
  const p = configPath();
  if (!fs.existsSync(p)) return [];
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (error) {
    process.stderr.write(`warn: could not read ${p}: ${error.message}\n`);
    return [];
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (error) {
    process.stderr.write(`warn: invalid JSON in ${p}: ${error.message}\n`);
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidEntry);
}

function append(entry) {
  if (!isValidEntry(entry)) throw new Error('config entry must have {name, path}');
  const absolutePath = path.resolve(entry.path);
  const list = read();
  const existing = list.find(e => path.resolve(e.path) === absolutePath);
  if (existing) return { added: false, entry: existing, list };
  const next = { name: entry.name, path: absolutePath };
  list.push(next);
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(list, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, p);
  return { added: true, entry: next, list };
}

function ensureFile() {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, '[]\n', { mode: 0o600 });
  }
  return p;
}

module.exports = { configPath, read, append, ensureFile };
