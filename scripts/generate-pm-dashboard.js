#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'pm.html');
const ARTIFACT_DIR = '.project-manager';

function rejectSymlink(file) {
  if (fs.lstatSync(file).isSymbolicLink()) {
    throw new Error(`symlink path rejected: ${file}`);
  }
}

function artifactRoot(project) {
  const root = path.resolve(project, ARTIFACT_DIR);
  if (fs.existsSync(root)) rejectSymlink(root);
  return root;
}

function readArtifacts(project) {
  const root = artifactRoot(project);
  const result = { markdown: [], wireframes: [], json: [], unknown: [], warnings: [] };

  if (!fs.existsSync(root)) {
    result.warnings.push(`Missing artifact directory: ${ARTIFACT_DIR}`);
    return result;
  }
  if (!fs.statSync(root).isDirectory()) {
    result.warnings.push(`Artifact path is not a directory: ${ARTIFACT_DIR}`);
    return result;
  }

  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      let stat;
      try { stat = fs.lstatSync(absolute); } catch (error) {
        result.warnings.push(`Could not inspect ${relative}: ${error.message}`);
        continue;
      }
      if (stat.isSymbolicLink()) {
        result.warnings.push(`Skipped symlink: ${relative}`);
        continue;
      }
      if (stat.isDirectory()) { visit(absolute); continue; }
      if (!stat.isFile() || relative === 'pm.html') continue;

      let content;
      try { content = fs.readFileSync(absolute, 'utf8'); } catch (error) {
        result.warnings.push(`Could not read ${relative}: ${error.message}`);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (extension === '.json') {
        try { result.json.push({ path: relative, value: JSON.parse(content) }); }
        catch (error) {
          result.warnings.push(`Malformed JSON ${relative}: ${error.message}`);
          result.unknown.push({ path: relative, content, kind: 'malformed-json' });
        }
      } else if (['.md', '.markdown', '.txt'].includes(extension)) {
        result.markdown.push({ path: relative, content });
      } else if (extension === '.html' && relative.startsWith('requirements/wireframes/')) {
        result.wireframes.push({ path: relative, content });
      } else {
        result.unknown.push({ path: relative, content });
      }
    }
  }
  visit(root);
  for (const key of ['markdown', 'wireframes', 'json', 'unknown', 'warnings']) {
    result[key].sort((a, b) => (a.path || a).localeCompare(b.path || a));
  }
  return result;
}

function atomicWrite(destination, content) {
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  rejectSymlink(parent);
  if (fs.existsSync(destination)) rejectSymlink(destination);
  const temporary = path.join(parent, `.${path.basename(destination)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    rejectSymlink(parent);
    if (fs.existsSync(destination)) rejectSymlink(destination);
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

function generate(project, options = {}) {
  const projectPath = path.resolve(project);
  const root = artifactRoot(projectPath);
  fs.mkdirSync(root, { recursive: true });
  rejectSymlink(root);
  const data = readArtifacts(projectPath);
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const embedded = JSON.stringify(data).replace(/</g, '\\u003c');
  atomicWrite(path.join(root, 'pm.html'), template.replace('__PM_DATA__', embedded));
  for (const warning of data.warnings) process.stderr.write(`warning: ${warning}\n`);
  if (!options.quiet) process.stdout.write(`${path.join(root, 'pm.html')}\n`);
  return data;
}

function main(argv) {
  let project = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') {
      if (project !== null || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--project requires one path');
      project = argv[++i];
    } else if (argv[i].startsWith('--')) throw new Error(`unknown option: ${argv[i]}`);
    else if (project !== null) throw new Error('use a positional project path or --project, not both');
    else project = argv[i];
  }
  if (!project) throw new Error('a project path is required');
  generate(project);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`error: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { generate, readArtifacts };
