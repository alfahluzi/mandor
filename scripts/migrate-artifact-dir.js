#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = '.project-manager';
const TARGET_DIR = '.mandor';

function migrate(target, options = {}) {
  const project = path.resolve(target || '.');
  const source = path.join(project, SOURCE_DIR);
  const destination = path.join(project, TARGET_DIR);

  if (!fs.existsSync(source)) {
    return `no ${SOURCE_DIR} dir at ${project}, nothing to migrate`;
  }
  if (!fs.lstatSync(source).isDirectory()) {
    throw new Error(`not a directory: ${source}`);
  }
  const destinationExists = fs.existsSync(destination);
  if (destinationExists && !options.force) {
    throw new Error(`target ${TARGET_DIR} already exists, use --force to overwrite (WARNING: deletes existing ${TARGET_DIR})`);
  }
  if (options.check) {
    return `would rename ${source} -> ${destination}${destinationExists ? ` (deleting existing ${destination})` : ''}`;
  }
  if (destinationExists) fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(source, destination);
  return `renamed ${source} -> ${destination}`;
}

function help() {
  return [
    'Usage: node scripts/migrate-artifact-dir.js [--check] [--force] [path ...]',
    '',
    `Rename each project's ${SOURCE_DIR}/ artifact tree to ${TARGET_DIR}/.`,
    'Paths default to the current directory; multiple paths are processed in order.',
    '',
    'Options:',
    '  --check   Report the planned rename without touching the filesystem',
    `  --force   Delete an existing ${TARGET_DIR}/ before renaming`,
    '  --help    Show this help',
    ''
  ].join('\n');
}

function main(argv) {
  const paths = [];
  let check = false;
  let force = false;
  for (const word of argv) {
    if (word === '--check') check = true;
    else if (word === '--force') force = true;
    else if (word === '--help' || word === '-h') { process.stdout.write(help()); return 0; }
    else if (word.startsWith('--')) throw new Error(`unknown option: ${word}`);
    else paths.push(word);
  }
  if (!paths.length) paths.push('.');

  let failed = false;
  for (const target of paths) {
    try { process.stdout.write(`${migrate(target, { check, force })}\n`); }
    catch (error) { process.stderr.write(`error: ${error.message}\n`); failed = true; }
  }
  return failed ? 1 : 0;
}

if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    if (result !== null) process.exitCode = result;
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { migrate, main, SOURCE_DIR, TARGET_DIR };
