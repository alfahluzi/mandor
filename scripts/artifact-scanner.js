'use strict';

const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '.mandor';

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

module.exports = {
  ARTIFACT_DIR,
  rejectSymlink,
  artifactRoot,
  readArtifacts
};
