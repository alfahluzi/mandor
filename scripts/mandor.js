#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const STATUSES = ['todo', 'in_progress', 'completed', 'failed'];
const DECISIONS = ['requested', 'approved', 'rejected'];
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const PREFIXES = { source: 'source', milestone: 'milestone', wbs: 'wbs', risk: 'risk', change: 'change', task: 'task' };
const PLAN_ACTIONS = new Set([
  'list', 'summary', 'init', 'add-phase', 'update-phase', 'delete-phase',
  'add-source', 'update-source', 'delete-source', 'add-task', 'update-task',
  'delete-task', 'set-task-status', 'add-progress', 'update-progress',
  'delete-progress', 'add-change', 'update-change', 'delete-change'
]);
const PLAN_ACTION_PREFIXES = ['add-', 'update-', 'delete-', 'set-'];

class PMError extends Error {}
const now = () => new Date().toISOString().replace('.000Z', 'Z');
function requireString(value, label) { if (typeof value !== 'string' || !value) throw new PMError(`${label} must be non-empty text`); return value; }
function validateName(value) { if (typeof value !== 'string' || !NAME_RE.test(value)) throw new PMError('plan name must use lowercase kebab-case'); return value; }
function validateTimestamp(value, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !ISO_RE.test(value) || Number.isNaN(Date.parse(value))) throw new PMError(`invalid ISO 8601 timestamp: ${value}`);
  return value;
}
function validateStatus(value) { if (!STATUSES.includes(value)) throw new PMError(`status must be one of: ${STATUSES.join(', ')}`); return value; }
function integer(value, label) { if (!Number.isInteger(value) || value < 0) throw new PMError(`${label} must be an integer >= 0`); return value; }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new PMError(`invalid ${label} fields; expected: ${keys.join(', ')}`);
}
function uniqueIds(items, label) { const ids = new Set(); const prefix = PREFIXES[label] || label; for (const item of items) { requireString(item.id, `${label} id`); if (!new RegExp(`^${prefix}-\\d{3,}$`).test(item.id)) throw new PMError(`invalid ${label} ID: ${item.id}`); if (ids.has(item.id)) throw new PMError(`duplicate ${label} ID: ${item.id}`); ids.add(item.id); } return ids; }
function validateCounter(value, key, items) { const maximum = items.reduce((max, item) => { const match = item.id.match(/-(\d+)$/); return match ? Math.max(max, Number(match[1])) : max; }, 0); if (value <= maximum) throw new PMError(`next_ids.${key} must exceed existing IDs`); }
function validateChange(value) {
  exact(value, ['id', 'timestamp', 'summary', 'reason', 'affected_ids', 'decision', 'evidence'], 'change request');
  requireString(value.id, 'change id'); validateTimestamp(value.timestamp, true); requireString(value.summary, 'change summary'); requireString(value.reason, 'change reason');
  if (!Array.isArray(value.affected_ids) || value.affected_ids.some(id => typeof id !== 'string')) throw new PMError('affected_ids must be a list of text IDs');
  if (!DECISIONS.includes(value.decision)) throw new PMError('change decision must be requested, approved, or rejected');
  if (value.evidence !== null && typeof value.evidence !== 'string') throw new PMError('change evidence must be text or null');
}
function validateTimeline(document) {
  exact(document, ['schema_version', 'name', 'version', 'created_at', 'updated_at', 'next_ids', 'approval', 'source_trace', 'milestones', 'wbs', 'risk_register', 'change_request_log'], 'timeline');
  if (document.schema_version !== '1.0') throw new PMError('schema_version must be 1.0'); validateName(document.name); requireString(document.version, 'version'); validateTimestamp(document.created_at, true); validateTimestamp(document.updated_at, true);
  exact(document.next_ids, ['source', 'milestone', 'wbs', 'risk', 'change'], 'next_ids'); Object.entries(document.next_ids).forEach(([key, value]) => integer(value, `next_ids.${key}`));
  exact(document.approval, ['status', 'timestamp', 'evidence'], 'approval'); if (!DECISIONS.includes(document.approval.status)) throw new PMError('invalid approval status'); validateTimestamp(document.approval.timestamp, true); if (document.approval.evidence !== null && typeof document.approval.evidence !== 'string') throw new PMError('approval evidence must be text or null');
  for (const key of ['source_trace', 'milestones', 'wbs', 'risk_register', 'change_request_log']) if (!Array.isArray(document[key])) throw new PMError(`${key} must be a list`);
  const sources = uniqueIds(document.source_trace, 'source'); for (const item of document.source_trace) { exact(item, ['id', 'location', 'claim'], 'source trace'); requireString(item.location, 'source location'); requireString(item.claim, 'source claim'); }
  const milestones = uniqueIds(document.milestones, 'milestone'); for (const item of document.milestones) { exact(item, ['id', 'name', 'status', 'start_timestamp', 'target_timestamp'], 'milestone'); if (!milestones.has(item.id)) throw new PMError('invalid milestone ID'); requireString(item.name, 'milestone name'); validateStatus(item.status); validateTimestamp(item.start_timestamp); validateTimestamp(item.target_timestamp); }
  uniqueIds(document.wbs, 'wbs'); for (const item of document.wbs) { exact(item, ['id', 'milestone_id', 'name'], 'WBS'); if (!milestones.has(item.milestone_id)) throw new PMError(`WBS references missing milestone: ${item.milestone_id}`); requireString(item.name, 'WBS name'); }
  uniqueIds(document.risk_register, 'risk'); for (const item of document.risk_register) { exact(item, ['id', 'description', 'likelihood', 'impact', 'mitigation', 'owner', 'status'], 'risk'); for (const key of ['description', 'likelihood', 'impact', 'mitigation', 'owner', 'status']) requireString(item[key], `risk ${key}`); }
  uniqueIds(document.change_request_log, 'change'); document.change_request_log.forEach(validateChange); for (const key of Object.keys(document.next_ids)) validateCounter(document.next_ids[key], key, document[key === 'source' ? 'source_trace' : key === 'milestone' ? 'milestones' : key === 'wbs' ? 'wbs' : key === 'risk' ? 'risk_register' : 'change_request_log']); const references = new Set([...document.source_trace, ...document.milestones, ...document.wbs, ...document.risk_register, ...document.change_request_log].map(item => item.id)); for (const item of document.change_request_log) for (const affected of item.affected_ids) if (!references.has(affected)) throw new PMError(`change references missing ID: ${affected}`); return { sources, milestones };
}
function validatePhase(document, filename, milestoneIds) {
  exact(document, ['schema_version', 'plan_name', 'phase_number', 'milestone_id', 'title', 'status', 'created_at', 'updated_at', 'next_ids', 'source_trace', 'tasks', 'change_request_log'], 'phase');
  if (document.schema_version !== '1.0') throw new PMError('schema_version must be 1.0'); validateName(document.plan_name); integer(document.phase_number, 'phase_number'); if (path.basename(filename) !== `phase_${document.phase_number}.json`) throw new PMError('phase number does not match filename');
  if (!milestoneIds.has(document.milestone_id)) throw new PMError(`phase references missing milestone: ${document.milestone_id}`); requireString(document.title, 'phase title'); validateStatus(document.status); validateTimestamp(document.created_at, true); validateTimestamp(document.updated_at, true);
  exact(document.next_ids, ['source', 'task', 'change'], 'phase next_ids'); Object.entries(document.next_ids).forEach(([key, value]) => integer(value, `next_ids.${key}`));
  for (const key of ['source_trace', 'tasks', 'change_request_log']) if (!Array.isArray(document[key])) throw new PMError(`${key} must be a list`);
  uniqueIds(document.source_trace, 'source'); for (const item of document.source_trace) { exact(item, ['id', 'milestone_id', 'location', 'claim'], 'phase source trace'); if (!milestoneIds.has(item.milestone_id)) throw new PMError('phase source references missing milestone'); requireString(item.location, 'source location'); requireString(item.claim, 'source claim'); }
  uniqueIds(document.tasks, 'task'); for (const item of document.tasks) { exact(item, ['id', 'title', 'detail', 'status', 'progress'], 'task'); requireString(item.title, 'task title'); requireString(item.detail, 'task detail'); validateStatus(item.status); if (!Array.isArray(item.progress)) throw new PMError('task progress must be a list'); for (const progress of item.progress) { exact(progress, ['timestamp', 'message'], 'progress'); validateTimestamp(progress.timestamp, true); requireString(progress.message, 'progress message'); } }
  uniqueIds(document.change_request_log, 'change'); document.change_request_log.forEach(validateChange); for (const key of Object.keys(document.next_ids)) validateCounter(document.next_ids[key], key, document[key === 'source' ? 'source_trace' : key === 'task' ? 'tasks' : 'change_request_log']); const references = new Set([...document.source_trace, ...document.tasks, ...document.change_request_log].map(item => item.id)); for (const item of document.change_request_log) for (const affected of item.affected_ids) if (!references.has(affected)) throw new PMError(`change references missing ID: ${affected}`);
}

function ensurePathSafe(root, target) {
  const absoluteRoot = path.resolve(root); const absolute = path.resolve(target);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) throw new PMError('path escapes project root');
  let cursor = absoluteRoot;
  for (const part of path.relative(absoluteRoot, absolute).split(path.sep)) { if (!part) continue; cursor = path.join(cursor, part); if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new PMError(`symlink path rejected: ${cursor}`); }
  return absolute;
}
function ensureDirectory(root, directory) {
  const absolute = ensurePathSafe(root, directory); const relative = path.relative(root, absolute); let cursor = path.resolve(root);
  for (const part of relative.split(path.sep)) { if (!part) continue; cursor = path.join(cursor, part); if (fs.existsSync(cursor)) { if (fs.lstatSync(cursor).isSymbolicLink()) throw new PMError(`symlink path rejected: ${cursor}`); if (!fs.statSync(cursor).isDirectory()) throw new PMError(`not a directory: ${cursor}`); } else fs.mkdirSync(cursor); }
  return absolute;
}
function atomicWrite(root, file, value) {
  const target = ensurePathSafe(root, file); ensureDirectory(root, path.dirname(target)); if (fs.existsSync(target)) { if (fs.lstatSync(target).isSymbolicLink()) throw new PMError(`symlink path rejected: ${target}`); }
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`); let fd;
  try { fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; ensureDirectory(root, path.dirname(target)); if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new PMError(`symlink path rejected: ${target}`); fs.renameSync(temporary, target); }
  catch (error) { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(temporary); } catch (_) {} throw error; }
}
function readJson(file) { let value; try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { throw new PMError(`invalid JSON: ${file}: ${error.message}`); } return value; }

class Store {
  constructor(project) { this.project = path.resolve(project || '.'); if (!fs.existsSync(this.project)) fs.mkdirSync(this.project, { recursive: true }); ensureDirectory(this.project, this.project); this.root = ensurePathSafe(this.project, path.join(this.project, '.mandor')); this.plans = path.join(this.root, 'plans'); }
  timelinePath() { return path.join(this.plans, 'milestone-timeline.json'); }
  timeline() { const file = this.timelinePath(); if (!fs.existsSync(file)) throw new PMError('milestone timeline does not exist; run milestone init'); ensurePathSafe(this.project, file); const document = readJson(file); validateTimeline(document); return document; }
  phasePath(plan, number) { validateName(plan); integer(number, 'phase number'); return ensurePathSafe(this.project, path.join(this.plans, plan, `phase_${number}.json`)); }
  phaseFiles(plan) { validateName(plan); const directory = ensurePathSafe(this.project, path.join(this.plans, plan)); if (!fs.existsSync(directory)) return []; ensurePathSafe(this.project, directory); if (!fs.statSync(directory).isDirectory()) throw new PMError(`not a plan directory: ${plan}`); return fs.readdirSync(directory).sort().filter(file => /^phase_[0-9]+\.json$/.test(file)).map(file => ensurePathSafe(this.project, path.join(directory, file))); }
  phase(plan, number) { const file = this.phasePath(plan, number); if (!fs.existsSync(file)) throw new PMError(`missing phase: ${plan}/${number}`); const document = readJson(file); validatePhase(document, file, new Set(this.timeline().milestones.map(item => item.id))); return document; }
  commit(file, document) { atomicWrite(this.project, file, document); }
}
function nextId(document, key) { const value = document.next_ids[key]; document.next_ids[key] += 1; return `${PREFIXES[key]}-${String(value).padStart(3, '0')}`; }
function updateTimestamp(document) { document.updated_at = now(); }
function find(items, id) { const item = items.find(value => value.id === id); if (!item) throw new PMError(`not found: ${id}`); return item; }
function required(options, keys) { for (const key of keys) if (options[key] === undefined) throw new PMError(`the following argument is required: --${key.replace(/_/g, '-')}`); }
function changeFrom(options, id) { required(options, ['summary', 'reason']); return { id, timestamp: now(), summary: options.summary, reason: options.reason, affected_ids: options.affected_id || [], decision: options.decision || 'requested', evidence: options.evidence ?? null }; }
function editChange(item, options) { if (!['summary', 'reason', 'affected_id', 'decision', 'evidence'].some(key => options[key] !== undefined)) throw new PMError('at least one editable field is required'); if (options.summary !== undefined) item.summary = options.summary; if (options.reason !== undefined) item.reason = options.reason; if (options.affected_id !== undefined) item.affected_ids = options.affected_id; if (options.decision !== undefined) item.decision = options.decision; if (options.evidence !== undefined) item.evidence = options.evidence; validateChange(item); }

function initScaffold(store, options) {
  const created = [];
  const targets = [{ path: store.root, label: '.mandor' }, { path: store.plans, label: 'plans' }];
  for (const target of targets) {
    if (fs.existsSync(target.path)) {
      if (!fs.lstatSync(target.path).isDirectory()) throw new PMError(`not a directory: ${target.path}`);
      continue;
    }
    ensureDirectory(store.project, target.path);
    created.push(target.label);
  }
  return { project: store.project, root: store.root, plans: store.plans, created: created.length ? created : 'already present' };
}

function mutateTimeline(store, options) {
  const file = store.timelinePath();
  if (options.action === 'init') { required(options, ['name', 'version']); validateName(options.name); if (fs.existsSync(file) && !options.force) throw new PMError('timeline exists; use --force'); ensureDirectory(store.project, store.plans); const document = { schema_version: '1.0', name: options.name, version: options.version, created_at: now(), updated_at: now(), next_ids: { source: 1, milestone: 1, wbs: 1, risk: 1, change: 1 }, approval: { status: 'requested', timestamp: now(), evidence: null }, source_trace: [], milestones: [], wbs: [], risk_register: [], change_request_log: [] }; validateTimeline(document); store.commit(file, document); return document; }
  const document = store.timeline(); if (!options.action || options.action === 'get') return document; if (options.action === 'list') return { source_trace: document.source_trace, milestones: document.milestones, wbs: document.wbs, risk_register: document.risk_register, change_request_log: document.change_request_log };
  if (options.action === 'update-metadata') { if (options.name === undefined && options.version === undefined) throw new PMError('at least one editable field is required'); if (options.name !== undefined) document.name = validateName(options.name); if (options.version !== undefined) document.version = requireString(options.version, 'version'); }
  else if (options.action === 'approve') { required(options, ['status']); if (!DECISIONS.includes(options.status)) throw new PMError('approval status must be requested, approved, or rejected'); document.approval = { status: options.status, timestamp: now(), evidence: options.evidence ?? null }; }
  else editTimelineCollection(store, document, options);
  updateTimestamp(document); validateTimeline(document); store.commit(file, document); return document;
}
function editTimelineCollection(store, document, options) {
  const map = { source: ['source_trace', 'source_id'], milestone: ['milestones', 'milestone_id'], wbs: ['wbs', 'wbs_id'], risk: ['risk_register', 'risk_id'], change: ['change_request_log', 'change_id'] }; const kind = Object.keys(map).find(key => options.action.endsWith(`-${key}`)); if (!kind) throw new PMError(`unknown milestone command: ${options.action}`); const [collection] = map[kind]; const items = document[collection];
  if (options.action.startsWith('add-')) { const id = nextId(document, kind); if (kind === 'source') { required(options, ['location', 'claim']); items.push({ id, location: options.location, claim: options.claim }); } else if (kind === 'milestone') { required(options, ['name']); items.push({ id, name: options.name, status: options.status || 'todo', start_timestamp: options.start ?? null, target_timestamp: options.target ?? null }); } else if (kind === 'wbs') { required(options, ['milestone_id', 'name']); if (!document.milestones.some(item => item.id === options.milestone_id)) throw new PMError('unknown milestone ID'); items.push({ id, milestone_id: options.milestone_id, name: options.name }); } else if (kind === 'risk') { required(options, ['description']); items.push({ id, description: options.description, likelihood: options.likelihood || 'unknown', impact: options.impact || 'unknown', mitigation: options.mitigation || 'not yet mitigated', owner: options.owner || 'unassigned', status: options.risk_status || 'open' }); } else items.push(changeFrom(options, id)); return; }
  const id = options[map[kind][1]]; if (!id) throw new PMError(`the following argument is required: --${map[kind][1].replace(/_/g, '-')}`); const item = find(items, id);
  if (options.action.startsWith('delete-')) { if (kind === 'milestone' && (document.wbs.some(value => value.milestone_id === id) || hasPhaseReference(store, id))) throw new PMError('milestone has phase references'); items.splice(items.indexOf(item), 1); return; }
  if (kind === 'change') { editChange(item, options); return; } const fields = kind === 'source' ? ['location', 'claim'] : kind === 'milestone' ? ['name', 'status', 'start', 'target'] : kind === 'wbs' ? ['name', 'milestone_id'] : ['description', 'likelihood', 'impact', 'mitigation', 'owner', 'risk_status']; if (!fields.some(key => options[key] !== undefined)) throw new PMError('at least one editable field is required'); for (const key of fields) if (options[key] !== undefined) { if (key === 'status') item.status = validateStatus(options[key]); else if (key === 'start' || key === 'target') item[`${key}_timestamp`] = validateTimestamp(options[key]); else if (key === 'milestone_id') { if (!document.milestones.some(value => value.id === options[key])) throw new PMError('unknown milestone ID'); item[key] = options[key]; } else item[key === 'risk_status' ? 'status' : key] = options[key]; }
}
function hasPhaseReference(store, id) {
  if (!fs.existsSync(store.plans)) return false;
  for (const plan of fs.readdirSync(store.plans).sort()) {
    const directory = path.join(store.plans, plan);
    if (!NAME_RE.test(plan) || !fs.existsSync(directory)) continue;
    if (!fs.lstatSync(directory).isDirectory()) throw new PMError(`not a plan directory: ${plan}`);
    for (const file of store.phaseFiles(plan)) {
      const phase = store.phase(plan, Number(path.basename(file).match(/\d+/)[0]));
      if (phase.milestone_id === id || phase.source_trace.some(source => source.milestone_id === id)) return true;
    }
  }
  return false;
}

function mutatePlan(store, options) {
  const plan = options.plan || options._[0];

  if (options.action === 'init') {
    required({ plan }, ['plan']);
    validateName(plan);
    const directory = path.join(store.plans, plan);
    if (fs.existsSync(directory)) {
      ensureDirectory(store.project, directory);
      return {
        plan_name: plan,
        initialized: false,
        phase_count: store.phaseFiles(plan).length
      };
    }
    ensureDirectory(store.project, directory);
    return { plan_name: plan, initialized: true, phase_count: 0 };
  }

  if (options.action === 'list') {
    if (!fs.existsSync(store.plans)) return [];
    return fs.readdirSync(store.plans).sort().filter(name => {
      const directory = path.join(store.plans, name);
      return NAME_RE.test(name)
        && fs.existsSync(directory)
        && fs.lstatSync(directory).isDirectory();
    }).map(name => planSummary(store, name));
  }

  if (!plan) throw new PMError('plan name is required');
  validateName(plan);
  if (options.action === 'summary') {
    const maximumPositional = options._[1] === 'summary' ? 3 : 2;
    if (options._.length > maximumPositional) {
      throw new PMError(`unknown plan command: ${options._[1]}`);
    }
    return planSummary(store, plan, options.phase);
  }
  if (!PLAN_ACTIONS.has(options.action)) {
    throw new PMError(`unknown plan command: ${options.action}`);
  }
  if (options.action === 'add-phase' || options.action === 'update-phase' || options.action === 'delete-phase') return mutatePhase(store, plan, options);
  options.task_id ||= options._[3];
  return mutatePhaseContent(store, plan, options);
}
function planSummary(store, plan, phase) { if (phase !== undefined) return store.phase(plan, phase); const rows = store.phaseFiles(plan).map(file => { const p = store.phase(plan, Number(path.basename(file).match(/\d+/)[0])); const total = p.tasks.length; const done = p.tasks.filter(task => task.status === 'completed').length; return { phase_number: p.phase_number, title: p.title, status: p.status, task_completion_percentage: total ? Math.round(done * 100 / total) : 0 }; }); const taskCount = store.phaseFiles(plan).reduce((total, file) => total + store.phase(plan, Number(path.basename(file).match(/\d+/)[0])).tasks.length, 0); const completed = store.phaseFiles(plan).reduce((total, file) => total + store.phase(plan, Number(path.basename(file).match(/\d+/)[0])).tasks.filter(task => task.status === 'completed').length, 0); return { plan_name: plan, phase_count: rows.length, task_count: taskCount, completion_percentage: taskCount ? Math.round(completed * 100 / taskCount) : 0, phases: rows }; }
function mutatePhase(store, plan, options) { const number = options.phase; required(options, ['phase']); const file = store.phasePath(plan, number); const timeline = store.timeline(); const milestoneIds = new Set(timeline.milestones.map(item => item.id)); if (options.action === 'add-phase') { if (timeline.approval.status !== 'approved') throw new PMError('timeline must be approved before adding phases'); if (fs.existsSync(file)) throw new PMError('phase already exists'); required(options, ['milestone_id', 'title']); if (!milestoneIds.has(options.milestone_id)) throw new PMError('unknown milestone ID'); ensureDirectory(store.project, path.dirname(file)); const phase = { schema_version: '1.0', plan_name: plan, phase_number: number, milestone_id: options.milestone_id, title: options.title, status: options.status || 'todo', created_at: now(), updated_at: now(), next_ids: { source: 1, task: 1, change: 1 }, source_trace: [], tasks: [], change_request_log: [] }; validatePhase(phase, file, milestoneIds); store.commit(file, phase); return phase; } const phase = store.phase(plan, number); if (options.action === 'delete-phase') { if (phase.tasks.length && !options.force) throw new PMError('phase is non-empty; use --force for irreversible deletion'); fs.rmSync(file, { force: true }); return { deleted: path.basename(file) }; } if (options.action === 'update-phase') { if (!['milestone_id', 'title', 'status'].some(key => options[key] !== undefined)) throw new PMError('at least one editable field is required'); if (options.milestone_id !== undefined && !milestoneIds.has(options.milestone_id)) throw new PMError('unknown milestone ID'); if (options.milestone_id !== undefined) phase.milestone_id = options.milestone_id; if (options.title !== undefined) phase.title = options.title; if (options.status !== undefined) phase.status = validateStatus(options.status); } phase.updated_at = now(); validatePhase(phase, file, milestoneIds); store.commit(file, phase); return phase; }
function mutatePhaseContent(store, plan, options) { const number = options.phase; required(options, ['phase']); const file = store.phasePath(plan, number); const phase = store.phase(plan, number); const timeline = store.timeline(); const milestones = new Set(timeline.milestones.map(item => item.id)); const id = options.task_id; const action = options.action; if (!id && !['add-source', 'add-task', 'add-change'].includes(action)) throw new PMError('an item ID (SOURCE_ID/TASK_ID/CHANGE_ID) is required'); if (action === 'add-source') { required(options, ['milestone_id', 'location', 'claim']); if (!milestones.has(options.milestone_id)) throw new PMError('unknown milestone ID'); phase.source_trace.push({ id: nextId(phase, 'source'), milestone_id: options.milestone_id, location: options.location, claim: options.claim }); } else if (action === 'add-task') { required(options, ['title', 'detail']); phase.tasks.push({ id: nextId(phase, 'task'), title: options.title, detail: options.detail, status: options.status || 'todo', progress: [] }); } else if (action === 'add-change') phase.change_request_log.push(changeFrom(options, nextId(phase, 'change'))); else { const collection = action.includes('source') ? phase.source_trace : action.includes('task') || action.includes('progress') ? phase.tasks : phase.change_request_log; const item = find(collection, id); if (['delete-source', 'delete-task', 'delete-change'].includes(action)) collection.splice(collection.indexOf(item), 1); else if (action === 'set-task-status') item.status = validateStatus(options.status); else if (action === 'add-progress') { required(options, ['message']); item.progress.push({ timestamp: now(), message: options.message }); } else if (action === 'update-progress' || action === 'delete-progress') { integer(options.index, 'index'); if (options.index >= item.progress.length) throw new PMError('progress index out of range'); if (action === 'delete-progress') item.progress.splice(options.index, 1); else { required(options, ['message']); item.progress[options.index] = { timestamp: now(), message: options.message }; } } else if (action === 'update-change') editChange(item, options); else if (action === 'update-source') { if (options.milestone_id !== undefined) { if (!milestones.has(options.milestone_id)) throw new PMError('unknown milestone ID'); item.milestone_id = options.milestone_id; } if (options.location !== undefined) item.location = options.location; if (options.claim !== undefined) item.claim = options.claim; } else if (action === 'update-task') { if (options.title !== undefined) item.title = options.title; if (options.detail !== undefined) item.detail = options.detail; if (options.status !== undefined) item.status = validateStatus(options.status); } else throw new PMError(`unknown plan command: ${action}`); }
  phase.updated_at = now(); validatePhase(phase, file, milestones); store.commit(file, phase); return phase;
}

const OPTION_KEYS = new Set(['name', 'version', 'force', 'status', 'evidence', 'location', 'claim', 'start', 'target', 'milestone_id', 'description', 'likelihood', 'impact', 'mitigation', 'owner', 'risk_status', 'summary', 'reason', 'affected_id', 'decision', 'phase', 'title', 'detail', 'task_id', 'message', 'index', 'port', 'host']);
function parseArgs(argv) { let project = '.', json = false; const words = []; for (let i = 0; i < argv.length; i += 1) { const word = argv[i]; if (word === '--json') json = true; else if (word === '--project') { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new PMError('--project requires a value'); project = argv[++i]; } else words.push(word); } const positional = []; const options = {}; for (let i = 0; i < words.length; i += 1) { const word = words[i]; if (!word.startsWith('--')) { positional.push(word); continue; } const key = word.slice(2).replace(/-/g, '_'); if (!OPTION_KEYS.has(key)) throw new PMError(`unknown option: ${word}`); if (key === 'force') { if (options.force) throw new PMError('duplicate option: --force'); options.force = true; continue; } if (key === 'affected_id') { if (!words[i + 1] || words[i + 1].startsWith('--')) throw new PMError(`${word} requires a value`); (options.affected_id ||= []).push(words[++i]); continue; } if (options[key] !== undefined) throw new PMError(`duplicate option: ${word}`); if (!words[i + 1] || words[i + 1].startsWith('--')) throw new PMError(`${word} requires a value`); options[key] = words[++i]; } for (const key of ['phase', 'index']) if (options[key] !== undefined) { if (!/^\d+$/.test(options[key])) throw new PMError(`${key} must be an integer`); options[key] = Number(options[key]); } options._ = positional; return { project, json, options }; }
function help(resource) {
  const lines = [];
  const out = (text = '') => lines.push(text);
  const usage = 'mandor [--project PATH] [--json] <command> [args]';
  if (!resource) {
    out(`${usage}`);
    out('');
    out('Manage the .mandor/ artifact tree for a project. The CLI atomically');
    out('validates JSON, writes atomically, and never');
    out('touches managed JSON files directly — only via the subcommands below.');
    out('');
    out('Global options:');
    out('  --project PATH   Target project directory (default: current directory)');
    out('  --json           Emit machine-readable JSON instead of human format');
    out('  --help [TOPIC]   Show this help, or help for: init, milestone, plan, dashboard');
    out('');
    out('Commands:');
    out('  init                            Create .mandor/ scaffold (idempotent)');
    out('  milestone [subcommand] [args]   Manage the milestone timeline');
    out('  plan [subcommand] [args]        Manage a plan and its phase files');
    out('  dashboard [--port N]            Start live HTTP dashboard (polls /api/data every 1s)');
    out('');
    out('Typical workflow:');
    out('  1. mandor init');
    out('  2. mandor milestone init --name K --version V');
    out('  3. mandor milestone add-milestone --name M1');
    out('  4. mandor milestone approve --status approved');
    out('  5. mandor plan init my-plan');
    out('  6. mandor plan add-phase my-plan --phase 1 --milestone-id milestone-001 --title "..."');
    out('  7. mandor plan add-task my-plan --phase 1 --title T --detail D');
    out('');
    out(`Run \`${usage.replace('<command> [args]', '<command> --help')}\` for command details.`);
    return `${lines.join('\n')}\n`;
  }
  if (resource === 'init') {
    out(`${usage.replace('<command> [args]', 'init')}`);
    out('');
    out('Create the .mandor/ scaffold under --project (default cwd).');
    out('Idempotent: reports "already present" when the scaffold exists.');
    out('After init, run `milestone init` and `plan init <name>` to populate data.');
    out('No options.');
    return `${lines.join('\n')}\n`;
  }
  if (resource === 'milestone') {
    out(`${usage.replace('<command> [args]', 'milestone <subcommand> [args]')}`);
    out('');
    out('Manage the single milestone timeline at .mandor/plans/milestone-timeline.json.');
    out('Subcommands:');
    out('  get                                       Print the full timeline document');
    out('  list                                      Print sources, milestones, WBS, risks, changes');
    out('  init --name K --version V [--force]       Create empty timeline (overwrite requires --force)');
    out('  update-metadata --name K | --version V    Update timeline name and/or version');
    out('  approve --status S [--evidence TEXT]      Set approval status: requested|approved|rejected');
    out('  add-source    --location --claim          Append source trace entry');
    out('  update-source SOURCE_ID [--location] [--claim]');
    out('  delete-source SOURCE_ID');
    out('  add-milestone --name [--status S] [--start ISO] [--target ISO]');
    out('  update-milestone MILESTONE_ID [--name] [--status S] [--start ISO] [--target ISO]');
    out('  delete-milestone MILESTONE_ID            Fails if any phase or WBS still references it');
    out('  add-wbs        --milestone-id ID --name');
    out('  update-wbs WBS_ID [--milestone-id ID] [--name]');
    out('  delete-wbs WBS_ID');
    out('  add-risk       --description [--likelihood L] [--impact I] [--mitigation M] [--owner O] [--risk-status S]');
    out('  update-risk RISK_ID [--description] [--likelihood] [--impact] [--mitigation] [--owner] [--risk-status]');
    out('  delete-risk RISK_ID');
    out('  add-change     --summary --reason [--affected-id ID ...] [--decision S] [--evidence TEXT]');
    out('  update-change CHANGE_ID [--summary] [--reason] [--affected-id ...] [--decision] [--evidence]');
    out('  delete-change CHANGE_ID');
    out('');
    out('Notes:');
    out('  - Milestone IDs are auto-generated milestone-NNN on add.');
    out('  - Run `milestone approve --status approved` before adding plan phases.');
    return `${lines.join('\n')}\n`;
  }
  if (resource === 'dashboard') {
    out(`${usage.replace('<command> [args]', 'dashboard [--port N] [--host H]')}`);
    out('');
    out('Start a live HTTP dashboard for the project. The server serves a live');
    out('UI that re-reads the .mandor/ tree on every /api/data poll (about once');
    out('per second). Markdown is rendered in the browser by the <md-block>');
    out('component (sanitized), so JSON and Markdown changes both appear within');
    out('about a second.');
    out('');
    out('Options:');
    out('  --port N   TCP port to bind (default: 4173)');
    out('  --host H   Interface to bind (default: 127.0.0.1)');
    out('');
    out('Endpoints served:');
    out('  GET /             Dashboard HTML');
    out('  GET /api/data     JSON snapshot of all artifacts');
    out('  GET /api/health   {ok, project, port, host, poll_interval_ms}');
    out('  GET /raw/<path>   Serve a raw file from .mandor/ (path-safe)');
    out('');
    out('Press Ctrl+C to stop the server.');
    return `${lines.join('\n')}\n`;
  }
  if (resource === 'plan') {
    out(`${usage.replace('<command> [args]', 'plan <subcommand> [args]')}`);
    out('');
    out('Manage plans and phase files under .mandor/plans/<plan>/.');
    out('Subcommands:');
    out('  list                                       List all plans in the project');
    out('  PLAN                                       Print summary for PLAN');
    out('  summary PLAN [--phase N]                   Print plan summary, or single phase when --phase given');
    out('  init PLAN                                  Create plan directory (idempotent)');
    out('  add-phase PLAN --phase N --milestone-id ID --title [--status S]   Requires approved timeline');
    out('  update-phase PLAN --phase N [--milestone-id ID] [--title] [--status S]');
    out('  delete-phase PLAN --phase N [--force]       Fails non-empty phase without --force');
    out('  add-source    PLAN --phase N --milestone-id ID --location --claim');
    out('  update-source PLAN --phase N SOURCE_ID [--milestone-id] [--location] [--claim]');
    out('  delete-source PLAN --phase N SOURCE_ID');
    out('  add-task      PLAN --phase N --title --detail [--status S]');
    out('  update-task   PLAN --phase N TASK_ID [--title] [--detail]');
    out('  delete-task   PLAN --phase N TASK_ID');
    out('  set-task-status PLAN --phase N TASK_ID --status S');
    out('  add-progress  PLAN --phase N TASK_ID --message');
    out('  update-progress PLAN --phase N TASK_ID --index I --message');
    out('  delete-progress PLAN --phase N TASK_ID --index I');
    out('  add-change    PLAN --phase N --summary --reason [--affected-id ID ...] [--decision] [--evidence]');
    out('  update-change PLAN --phase N CHANGE_ID [--summary] [--reason] [--affected-id ...] [--decision] [--evidence]');
    out('  delete-change PLAN --phase N CHANGE_ID');
    out('');
    out('Notes:');
    out('  - Plan names: lowercase kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$).');
    out('  - Statuses: todo | in_progress | completed | failed.');
    out('  - Progress entries are append-only by timestamp; use --index to edit/delete.');
    return `${lines.join('\n')}\n`;
  }
  out(`Unknown help topic: ${resource}`);
  out(`Run \`${usage}\` for the command list.`);
  return `${lines.join('\n')}\n`;
}



function formatHuman(value) {
  return util.inspect(value, {
    colors: false,
    compact: false,
    depth: null,
    sorted: false
  });
}

function main(argv) {
  if (argv.includes('--help')) {
    const resource = argv.find(value => value === 'init' || value === 'milestone' || value === 'plan' || value === 'dashboard');
    process.stdout.write(help(resource));
    return 0;
  }

  const parsed = parseArgs(argv);
  const options = parsed.options;
  const resource = options._[0];
  if (!resource) throw new PMError('resource is required');

  if (resource === 'dashboard') {
    return runDashboard(argv, parsed, options);
  }

  const store = new Store(parsed.project);
  let value;

  if (resource === 'milestone') {
    options.action = options._[1] || 'get';
    const ids = {
      source: 'source_id', milestone: 'milestone_id', wbs: 'wbs_id',
      risk: 'risk_id', change: 'change_id'
    };
    for (const [kind, key] of Object.entries(ids)) {
      if (options.action.endsWith(`-${kind}`) && options._[2]) {
        options[key] = options._[2];
      }
    }
    value = mutateTimeline(store, options);
  } else if (resource === 'plan') {
    const token = options._[1];
    if (!token) {
      options.action = 'list';
    } else if (PLAN_ACTIONS.has(token)) {
      options.action = token;
      options.plan = options._[2];
    } else if (PLAN_ACTION_PREFIXES.some(prefix => token.startsWith(prefix))) {
      throw new PMError(`unknown plan command: ${token}`);
    } else {
      options.action = 'summary';
      options.plan = token;
    }
    value = mutatePlan(store, options);
  } else if (resource === 'init') {
    value = initScaffold(store, options);
    const configStore = require('./config-store');
    try {
      const created = value && value.created;
      const fresh = Array.isArray(created) && created.includes('.mandor');
      if (fresh) {
        const result = configStore.append({
          name: path.basename(store.project) || path.basename(path.resolve(store.project)),
          path: path.resolve(store.project)
        });
        value.registered = result.added;
        value.registered_path = result.entry.path;
      } else if (created === 'already present') {
        value.registered = false;
        value.registered_path = path.resolve(store.project);
      }
    } catch (error) {
      value.registered_error = error.message;
    }
  } else {
    throw new PMError(`unknown command: ${resource} (expected: init, milestone, plan, dashboard)`);
  }

  process.stdout.write(`${parsed.json ? JSON.stringify(value, null, 2) : formatHuman(value)}\n`);
  return 0;
}
function runDashboard(argv, parsed, options) {
  const { spawn } = require('child_process');
  const args = [path.join(__dirname, 'dashboard-server.js')];
  if (parsed.project && parsed.project !== '.') {
    // kept for backwards compatibility: pre-register the project path so the
    // dashboard can see it without requiring a separate `mandor init` run.
    try {
      const configStore = require('./config-store');
      configStore.append({ name: path.basename(path.resolve(parsed.project)), path: path.resolve(parsed.project) });
    } catch (_) {}
  }
  if (options.port !== undefined) args.push('--port', String(options.port));
  if (options.host !== undefined) args.push('--host', String(options.host));
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  return new Promise((resolve) => {
    let settled = false;
    const settle = (code) => { if (!settled) { settled = true; resolve(code ?? 0); } };
    child.on('exit', (code) => settle(code));
    for (const sig of ['SIGINT', 'SIGTERM']) {
      const handler = () => { if (!settled) { try { child.kill(sig); } catch (_) {} } };
      process.on(sig, handler);
    }
  });
}
if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    if (result && typeof result.then === 'function') {
      result.then((code) => { process.exitCode = code ?? 0; }, (error) => {
        process.stderr.write(`error: ${error.message}\n`); process.exitCode = 1;
      });
    } else {
      process.exitCode = result;
    }
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
module.exports = { PMError, Store, validateTimeline, validatePhase, validateTimestamp, main };
