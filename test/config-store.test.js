'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-config-'));
  const file = path.join(dir, 'config.json');
  return { dir, file };
}

test('config-store: append + read round trip', () => {
  const { dir, file } = freshConfig();
  delete require.cache[require.resolve('../scripts/config-store')];
  process.env.MANDOR_CONFIG = file;
  const store = require('../scripts/config-store');

  assert.deepEqual(store.read(), []);
  const result = store.append({ name: 'alpha', path: path.join(dir, 'alpha') });
  assert.equal(result.added, true);
  assert.equal(result.entry.path, path.join(dir, 'alpha'));

  const list = store.read();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'alpha');
  assert.equal(list[0].path, path.join(dir, 'alpha'));

  delete process.env.MANDOR_CONFIG;
});

test('config-store: append is idempotent on absolute-path collision', () => {
  const { file } = freshConfig();
  delete require.cache[require.resolve('../scripts/config-store')];
  process.env.MANDOR_CONFIG = file;
  const store = require('../scripts/config-store');

  const first = store.append({ name: 'alpha', path: '/tmp/somewhere/alpha' });
  const second = store.append({ name: 'alpha-renamed', path: '/tmp/somewhere/alpha' });
  assert.equal(first.added, true);
  assert.equal(second.added, false);
  assert.equal(store.read().length, 1);

  delete process.env.MANDOR_CONFIG;
});

test('config-store: read tolerates missing + malformed + non-array files', () => {
  const cases = [
    { name: 'missing', setup: () => {} },
    { name: 'malformed JSON', setup: f => fs.writeFileSync(f, 'not json{') },
    { name: 'object instead of array', setup: f => fs.writeFileSync(f, '{"oops":1}') }
  ];
  for (const c of cases) {
    const { file } = freshConfig();
    c.setup(file);
    delete require.cache[require.resolve('../scripts/config-store')];
    process.env.MANDOR_CONFIG = file;
    const store = require('../scripts/config-store');
    assert.deepEqual(store.read(), [], c.name);
  }
  delete process.env.MANDOR_CONFIG;
});

test('config-store: ensureFile creates the file with []', () => {
  const { file } = freshConfig();
  delete require.cache[require.resolve('../scripts/config-store')];
  process.env.MANDOR_CONFIG = file;
  const store = require('../scripts/config-store');
  store.ensureFile();
  assert.equal(fs.existsSync(file), true);
  assert.equal(fs.readFileSync(file, 'utf8'), '[]\n');
  delete process.env.MANDOR_CONFIG;
});

test('config-store: skip malformed entries on read', () => {
  const { file } = freshConfig();
  fs.writeFileSync(file, JSON.stringify([
    { name: 'ok', path: '/tmp/ok' },
    { name: 123, path: '/tmp/bad' },
    null,
    { name: 'no-path' }
  ]));
  delete require.cache[require.resolve('../scripts/config-store')];
  process.env.MANDOR_CONFIG = file;
  const store = require('../scripts/config-store');
  const list = store.read();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'ok');
  delete process.env.MANDOR_CONFIG;
});

test('mandor init registers project path in config', () => {
  const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-init-')), 'config.json');
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-init-proj-'));

  const cli = path.resolve(__dirname, '..', 'scripts', 'mandor.js');
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [cli, '--project', projectDir, 'init'], {
    encoding: 'utf8',
    env: { ...process.env, MANDOR_CONFIG: configFile }
  });
  assert.equal(result.status, 0, result.stderr);

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(config.length, 1);
  assert.equal(config[0].name, path.basename(projectDir));
  assert.equal(config[0].path, projectDir);
});

test('mandor init is idempotent — re-running does not duplicate config entry', () => {
  const configFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-init2-')), 'config.json');
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-init2-proj-'));
  const cli = path.resolve(__dirname, '..', 'scripts', 'mandor.js');
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env, MANDOR_CONFIG: configFile };

  for (let i = 0; i < 2; i += 1) {
    const r = spawnSync(process.execPath, [cli, '--project', projectDir, 'init'], { encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(config.length, 1);
});
