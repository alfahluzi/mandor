#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ARTIFACT_DIR = '.project-manager';
const TEMPLATE_HTML = path.join(__dirname, '..', 'templates', 'dashboard.html');
const DEFAULT_PORT = 4173;
const POLL_INTERVAL_MS = 1000;

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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(md) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,6} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${renderInline(line.slice(level + 1))}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push(`<ul>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i += 1;
      }
      out.push(`<ol>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const buf = [];
    while (i < lines.length
      && lines[i].trim() !== ''
      && !/^#{1,6} /.test(lines[i])
      && !/^```/.test(lines[i])
      && !/^[-*] /.test(lines[i])
      && !/^\d+\. /.test(lines[i])
      && !/^>\s?/.test(lines[i])
      && !/^---+$/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function scanArtifacts(project) {
  const root = artifactRoot(project);
  const result = { markdown: [], wireframes: [], json: [], unknown: [], warnings: [], rendered: {} };

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
      try { stat = fs.lstatSync(absolute); }
      catch (error) {
        result.warnings.push(`Could not inspect ${relative}: ${error.message}`);
        continue;
      }
      if (stat.isSymbolicLink()) {
        result.warnings.push(`Skipped symlink: ${relative}`);
        continue;
      }
      if (stat.isDirectory()) { visit(absolute); continue; }
      if (!stat.isFile()) continue;

      let content;
      try { content = fs.readFileSync(absolute, 'utf8'); }
      catch (error) {
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

  for (const bucket of ['markdown', 'wireframes', 'json', 'unknown']) {
    result[bucket].sort((a, b) => a.path.localeCompare(b.path));
  }
  result.warnings.sort();
  for (const doc of result.markdown) {
    result.rendered[doc.path] = renderMarkdown(doc.content);
  }
  return result;
}

function safeJoin(root, relative) {
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) return null;
  return absolute;
}

function serve({ project, port, host = '127.0.0.1' }) {
  const root = artifactRoot(project);
  fs.mkdirSync(root, { recursive: true });
  let initial = scanArtifacts(project);
  const templateHtml = fs.readFileSync(TEMPLATE_HTML, 'utf8');

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${host}:${port}`);
      if (req.method !== 'GET') return send(res, 405, 'text/plain', 'method not allowed');

      if (url.pathname === '/' || url.pathname === '/index.html') {
        return send(res, 200, 'text/html; charset=utf-8', templateHtml);
      }
      if (url.pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, project, port, host, poll_interval_ms: POLL_INTERVAL_MS });
      }
      if (url.pathname === '/api/data') {
        const snapshot = scanArtifacts(project);
        initial = snapshot;
        return sendJson(res, 200, {
          ...snapshot,
          meta: {
            project,
            root,
            generated_at: new Date().toISOString(),
            poll_interval_ms: POLL_INTERVAL_MS
          }
        });
      }
      if (url.pathname === '/api/rerender') {
        initial = scanArtifacts(project);
        return sendJson(res, 200, { ok: true, rerendered: Object.keys(initial.rendered).length });
      }
      if (url.pathname.startsWith('/raw/')) {
        const relative = decodeURIComponent(url.pathname.slice('/raw/'.length));
        const absolute = safeJoin(root, relative);
        if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          return send(res, 404, 'text/plain', 'not found');
        }
        res.writeHead(200, { 'content-type': mimeFor(absolute), 'cache-control': 'no-store' });
        const stream = fs.createReadStream(absolute);
        stream.on('error', () => res.end('read error'));
        stream.pipe(res);
        return;
      }
      return send(res, 404, 'text/plain', 'not found');
    } catch (error) {
      return send(res, 500, 'text/plain', `server error: ${error.message}`);
    }
  });

  function send(res, status, type, body) {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  }
  function sendJson(res, status, value) {
    send(res, status, 'application/json; charset=utf-8', JSON.stringify(value));
  }

  server.listen(port, host, () => {
    process.stdout.write(`dashboard: http://${host}:${port}/\n`);
    process.stdout.write(`project:   ${project}\n`);
    process.stdout.write(`root:      ${root}\n`);
    process.stdout.write(`md docs:   ${Object.keys(initial.rendered).length} pre-rendered\n`);
    process.stdout.write(`poll:      ${POLL_INTERVAL_MS}ms\n`);
    process.stdout.write('press Ctrl+C to stop\n');
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      process.stdout.write(`\nreceived ${signal}, shutting down\n`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 2000).unref();
    });
  }
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml'
  };
  return map[ext] || 'application/octet-stream';
}

function main(argv) {
  let project = null;
  let port = DEFAULT_PORT;
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i];
    if (word === '--project') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--project requires one path');
      project = argv[++i];
    } else if (word === '--port') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--port requires a number');
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('--port must be 1..65535');
      port = value;
    } else if (word === '--host') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--host requires a value');
      // host passed via closure below
      process.env.PM_DASHBOARD_HOST = argv[++i];
    } else if (word === '--help' || word === '-h') {
      process.stdout.write('Usage: project-manager dashboard [--project PATH] [--port N] [--host H]\n');
      return 0;
    } else {
      throw new Error(`unknown option: ${word}`);
    }
  }
  if (!project) project = path.resolve('.');
  const host = process.env.PM_DASHBOARD_HOST || '127.0.0.1';
  serve({ project, port, host });
  return null;
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

module.exports = { serve, scanArtifacts, renderMarkdown, main, DEFAULT_PORT };
