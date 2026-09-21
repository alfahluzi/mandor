#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const {
  artifactRoot,
  readArtifacts
} = require('./artifact-scanner');

const TEMPLATE_HTML = path.join(__dirname, '..', 'templates', 'dashboard.html');
const DEFAULT_PORT = 4173;
const POLL_INTERVAL_MS = 1000;

function safeJoin(root, relative) {
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) return null;
  return absolute;
}

function isProjectDir(candidate) {
  try {
    if (fs.lstatSync(candidate).isSymbolicLink()) return false;
    if (!fs.statSync(candidate).isDirectory()) return false;
    const art = path.join(candidate, '.mandor');
    if (!fs.existsSync(art)) return false;
    if (fs.lstatSync(art).isSymbolicLink()) return false;
    return fs.statSync(art).isDirectory();
  } catch (_) {
    return false;
  }
}

function scanProjects(searchRoot) {
  const seen = new Set();
  const projects = [];
  const add = (raw) => {
    const absolute = path.resolve(raw);
    if (seen.has(absolute)) return;
    if (!isProjectDir(absolute)) return;
    seen.add(absolute);
    projects.push({ path: absolute, name: path.basename(absolute) || absolute });
  };
  // 1. The search root itself (if it has .mandor).
  add(searchRoot);
  // 2. One-level children of the search root.
  try {
    for (const entry of fs.readdirSync(searchRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      add(path.join(searchRoot, entry.name));
    }
  } catch (_) {}
  // 3. Env-configured roots: scan one level deep of each.
  const envRoots = (process.env.MANDOR_PROJECTS_ROOTS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const root of envRoots) {
    try {
      if (isProjectDir(root)) add(root);
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        add(path.join(root, entry.name));
      }
    } catch (_) {}
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

function resolveRequestedProject(defaultProject, requested) {
  if (!requested) return { project: defaultProject, requested: null };
  const absolute = path.resolve(requested);
  if (!isProjectDir(absolute)) {
    const error = new Error(`not a mandor project: ${absolute}`);
    error.statusCode = 400;
    throw error;
  }
  return { project: absolute, requested };
}

function serve({ project, port, host = '127.0.0.1', createRoot = true }) {
  const hasOwnProject = isProjectDir(project);
  if (hasOwnProject && createRoot) {
    fs.mkdirSync(artifactRoot(project), { recursive: true });
  }
  const templateHtml = fs.readFileSync(TEMPLATE_HTML, 'utf8');
  const projects = scanProjects(project);
  const defaultProject = project;
  const defaultIsUsable = hasOwnProject || projects.length > 0;

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
      if (url.pathname === '/api/projects') {
        return sendJson(res, 200, { default: defaultProject, projects });
      }
      if (url.pathname === '/api/data') {
        const requested = url.searchParams.get('project');
        if (!requested && !hasOwnProject) {
          return send(res, 400, 'text/plain', 'no project selected: pick one from the dropdown or pass ?project=PATH');
        }
        let active = defaultProject;
        let requestedProject = null;
        try {
          const resolved = resolveRequestedProject(defaultProject, requested || defaultProject);
          active = resolved.project;
          requestedProject = resolved.requested;
        } catch (error) {
          if (error.statusCode) return send(res, error.statusCode, 'text/plain', error.message);
          throw error;
        }
        const activeRoot = artifactRoot(active);
        return sendJson(res, 200, {
          ...readArtifacts(active),
          meta: {
            project: active,
            default_project: defaultProject,
            requested_project: requestedProject,
            root: activeRoot,
            generated_at: new Date().toISOString(),
            poll_interval_ms: POLL_INTERVAL_MS,
            mode: 'live'
          }
        });
      }
      if (url.pathname.startsWith('/raw/')) {
        const requested = url.searchParams.get('project');
        let active = defaultProject;
        try {
          active = resolveRequestedProject(defaultProject, requested).project;
        } catch (error) {
          if (error.statusCode) return send(res, error.statusCode, 'text/plain', error.message);
          throw error;
        }
        const activeRoot = artifactRoot(active);
        const relative = decodeURIComponent(url.pathname.slice('/raw/'.length));
        const absolute = safeJoin(activeRoot, relative);
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
    process.stdout.write(`discovery: ${path.resolve(project)}\n`);
    process.stdout.write(`projects:  ${projects.length} found\n`);
    if (projects.length === 0) {
      process.stdout.write('hint:     run from a parent of your project dirs, or set MANDOR_PROJECTS_ROOTS=/path1,/path2\n');
    } else {
      for (const p of projects) process.stdout.write(`  - ${p.path}${p.path === defaultProject ? ' (default)' : ''}\n`);
    }
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
      process.stdout.write('Usage: mandor dashboard [--project PATH] [--port N] [--host H]\n');
      process.stdout.write('Without --project, scans the current directory (and parents/siblings) for any folder containing .mandor/.\n');
      process.stdout.write('Set MANDOR_PROJECTS_ROOTS=/path1,/path2 to add custom discovery roots.\n');
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

module.exports = { serve, readArtifacts, main, scanProjects, resolveRequestedProject, DEFAULT_PORT };
