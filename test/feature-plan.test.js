'use strict';

// Validation suite for prompts/plans/build-feature-plan.md.
//
// Cross-checks every JSON shape, CLI flag, and lifecycle claim in the
// prompt against the actual validators exported by scripts/mandor.js,
// and exercises the full feature-plan lifecycle end-to-end via the CLI.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'mandor.js');
const SAMPLE_PHASE = path.join(ROOT, 'examples', 'sample-project', '.mandor', 'plans', 'toko-online', 'phase_1.json');

const { validatePhase, validateTimeline, PMError } = require(path.join(ROOT, 'scripts', 'mandor.js'));

const run = (dir, args) =>
  spawnSync(process.execPath, [CLI, '--project', dir, ...args], { encoding: 'utf8' });
const runJson = (dir, args) => {
  const result = run(dir, ['--json', ...args]);
  if (result.status !== 0) {
    throw new Error(`cli failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
};

function createProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-feature-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function bootstrap(t, { milestones = ['MVP Build'], approve = true } = {}) {
  const dir = createProject(t);
  assert.equal(run(dir, ['init']).status, 0, 'init scaffold');
  assert.equal(run(dir, ['milestone', 'init', '--name', 'toko-online', '--version', '0.1.0']).status, 0, 'milestone init');
  for (const name of milestones) {
    assert.equal(run(dir, ['milestone', 'add-milestone', '--name', name]).status, 0, `add milestone ${name}`);
  }
  assert.equal(run(dir, ['milestone', 'add-wbs', '--milestone-id', 'milestone-001', '--name', 'Auth & user profile']).status, 0, 'add wbs');
  if (approve) {
    assert.equal(run(dir, ['milestone', 'approve', '--status', 'approved']).status, 0, 'approve timeline');
  }
  return dir;
}

// Phase skeleton the CLI must produce when add-phase succeeds.
// Mirrors examples/sample-project/.mandor/plans/toko-online/phase_1.json.
const EXPECTED_PHASE_FIELDS = [
  'schema_version', 'plan_name', 'phase_number', 'milestone_id', 'title',
  'status', 'created_at', 'updated_at', 'next_ids', 'source_trace',
  'tasks', 'change_request_log',
];

describe('build-feature-plan prompt: lifecycle', () => {
  test('add-phase fails before timeline approval', (t) => {
    const dir = bootstrap(t, { approve: false });
    const result = run(dir, ['plan', 'init', 'features']);
    assert.equal(result.status, 0);
    const add = run(dir, ['plan', 'add-phase', 'features', '--phase', '1', '--milestone-id', 'milestone-001', '--title', 'auth']);
    assert.equal(add.status, 1, 'add-phase must reject unapproved timeline');
    assert.match(add.stderr, /timeline must be approved before adding phases/);
  });

  test('add-phase fails when milestone_id is unknown', (t) => {
    const dir = bootstrap(t);
    assert.equal(run(dir, ['plan', 'init', 'features']).status, 0);
    const result = run(dir, ['plan', 'add-phase', 'features', '--phase', '1', '--milestone-id', 'milestone-999', '--title', 'auth']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown milestone ID/);
  });

  test('add-source fails without --milestone-id (prompt says it is required)', (t) => {
    const dir = bootstrap(t);
    assert.equal(run(dir, ['plan', 'init', 'features']).status, 0);
    assert.equal(run(dir, ['plan', 'add-phase', 'features', '--phase', '1', '--milestone-id', 'milestone-001', '--title', 'auth']).status, 0);
    const result = run(dir, ['plan', 'add-source', 'features', '--phase', '1', '--location', 'requirements/PRD.md#auth', '--claim', 'email login']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--milestone-id/);
  });

  test('add-source with unknown milestone_id fails', (t) => {
    const dir = bootstrap(t);
    assert.equal(run(dir, ['plan', 'init', 'features']).status, 0);
    assert.equal(run(dir, ['plan', 'add-phase', 'features', '--phase', '1', '--milestone-id', 'milestone-001', '--title', 'auth']).status, 0);
    const result = run(dir, ['plan', 'add-source', 'features', '--phase', '1', '--milestone-id', 'milestone-999', '--location', 'requirements/PRD.md#auth', '--claim', 'email login']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown milestone ID/);
  });

  test('full feature-plan lifecycle: phase + task + source + change + progress', (t) => {
    const dir = bootstrap(t, { milestones: ['Discovery', 'MVP Build', 'Public Launch'] });

    // Plan init + feature phase per the prompt
    assert.equal(run(dir, ['plan', 'init', 'toko-features']).status, 0);
    assert.equal(run(dir, ['plan', 'add-phase', 'toko-features', '--phase', '1', '--milestone-id', 'milestone-002', '--title', 'auth-user-profile', '--status', 'todo']).status, 0);

    // One task per story (US-NNN)
    assert.equal(run(dir, ['plan', 'add-task', 'toko-features', '--phase', '1', '--title', 'US-001 Email signup', '--detail', 'Email+password signup with rate limit']).status, 0);
    assert.equal(run(dir, ['plan', 'add-task', 'toko-features', '--phase', '1', '--title', 'US-002 Google OAuth', '--detail', 'OAuth identity bridge']).status, 0);

    // Source trace entries must carry milestone_id
    assert.equal(run(dir, ['plan', 'add-source', 'toko-features', '--phase', '1', '--milestone-id', 'milestone-002', '--location', 'requirements/PRD.md#FR-001', '--claim', 'Email+password login required']).status, 0);
    assert.equal(run(dir, ['plan', 'add-source', 'toko-features', '--phase', '1', '--milestone-id', 'milestone-002', '--location', 'requirements/BRD.md#BR-007', '--claim', 'Buyer + seller personas in one account']).status, 0);

    // Change request via CLI flag shape documented in prompt
    assert.equal(run(dir, ['plan', 'add-change', 'toko-features', '--phase', '1', '--summary', 'Add password-reset email flow', '--reason', 'Forgot-password was missing from MVP spec', '--affected-id', 'task-001', '--decision', 'requested', '--evidence', 'null']).status, 0);

    // Progress on a task
    assert.equal(run(dir, ['plan', 'add-progress', 'toko-features', '--phase', '1', '--task-id', 'task-001', '--message', 'DDL merged']).status, 0);

    // set-task-status
    assert.equal(run(dir, ['plan', 'set-task-status', 'toko-features', '--phase', '1', '--task-id', 'task-002', '--status', 'in_progress']).status, 0);

    // Validate resulting phase via the exported validator
    const phase = JSON.parse(fs.readFileSync(path.join(dir, '.mandor', 'plans', 'toko-features', 'phase_1.json'), 'utf8'));
    const milestoneIds = new Set(['milestone-001', 'milestone-002', 'milestone-003']);
    assert.doesNotThrow(() => validatePhase(phase, path.join(dir, '.mandor', 'plans', 'toko-features', 'phase_1.json'), milestoneIds));

    // Field shape must match the example
    assert.deepEqual(Object.keys(phase).sort(), [...EXPECTED_PHASE_FIELDS].sort());
    assert.equal(phase.schema_version, '1.0');
    assert.equal(phase.plan_name, 'toko-features');
    assert.equal(phase.phase_number, 1);
    assert.equal(phase.milestone_id, 'milestone-002');
    assert.equal(phase.title, 'auth-user-profile');
    assert.equal(phase.status, 'todo');
    assert.equal(phase.next_ids.source, 3);
    assert.equal(phase.next_ids.task, 3);
    assert.equal(phase.next_ids.change, 2);
    assert.equal(phase.tasks.length, 2);
    assert.equal(phase.tasks[0].id, 'task-001');
    assert.equal(phase.tasks[0].status, 'todo');
    assert.equal(phase.tasks[0].progress.length, 1);
    assert.equal(phase.tasks[1].status, 'in_progress');
    assert.equal(phase.source_trace.length, 2);
    for (const source of phase.source_trace) {
      assert.match(source.id, /^source-\d{3}$/);
      assert.equal(source.milestone_id, 'milestone-002');
      assert.equal(typeof source.location, 'string');
      assert.equal(typeof source.claim, 'string');
    }
    assert.equal(phase.change_request_log.length, 1);
    const change = phase.change_request_log[0];
    assert.match(change.id, /^change-\d{3}$/);
    assert.equal(change.decision, 'requested');
    assert.deepEqual(change.affected_ids, ['task-001']);
    assert.match(change.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('summary CLI returns plan + phase rollup', (t) => {
    const dir = bootstrap(t);
    assert.equal(run(dir, ['plan', 'init', 'features']).status, 0);
    assert.equal(run(dir, ['plan', 'add-phase', 'features', '--phase', '1', '--milestone-id', 'milestone-001', '--title', 'auth']).status, 0);
    assert.equal(run(dir, ['plan', 'add-task', 'features', '--phase', '1', '--title', 'T1', '--detail', 'D1']).status, 0);
    assert.equal(run(dir, ['plan', 'add-task', 'features', '--phase', '1', '--title', 'T2', '--detail', 'D2']).status, 0);
    const summary = runJson(dir, ['plan', 'summary', 'features']);
    assert.equal(summary.plan_name, 'features');
    assert.equal(summary.phase_count, 1);
    assert.equal(summary.task_count, 2);
    assert.equal(summary.completion_percentage, 0);
    assert.equal(summary.phases[0].title, 'auth');
  });
});

describe('build-feature-plan prompt: phase JSON contract', () => {
  // Build a minimal valid phase skeleton the validator accepts.
  function validPhase() {
    return {
      schema_version: '1.0',
      plan_name: 'demo',
      phase_number: 1,
      milestone_id: 'milestone-001',
      title: 'demo',
      status: 'todo',
      created_at: '2026-09-18T08:00:00Z',
      updated_at: '2026-09-18T08:00:00Z',
      next_ids: { source: 1, task: 1, change: 1 },
      source_trace: [],
      tasks: [],
      change_request_log: [],
    };
  }

  const milestones = new Set(['milestone-001']);
  const filename = path.join(os.tmpdir(), 'phase_1.json');

  test('exact field set is enforced (no invented fields)', () => {
    const phase = validPhase();
    phase.extra_field = 'nope';
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid phase fields/);
  });

  test('schema_version must equal "1.0"', () => {
    const phase = validPhase();
    phase.schema_version = '2.0';
    assert.throws(() => validatePhase(phase, filename, milestones), /schema_version must be 1.0/);
  });

  test('plan_name must be lowercase kebab-case', () => {
    const phase = validPhase();
    phase.plan_name = 'Demo Plan';
    assert.throws(() => validatePhase(phase, filename, milestones), /plan name must use lowercase kebab-case/);
  });

  test('phase_number must match filename (phase_N.json)', () => {
    const phase = validPhase();
    phase.phase_number = 2;
    assert.throws(() => validatePhase(phase, filename, milestones), /phase number does not match filename/);
  });

  test('milestone_id must exist in the timeline', () => {
    const phase = validPhase();
    phase.milestone_id = 'milestone-999';
    assert.throws(() => validatePhase(phase, filename, milestones), /phase references missing milestone/);
  });

  test('status must be one of todo|in_progress|completed|failed', () => {
    for (const bad of ['pending', 'in-progress', 'IN_PROGRESS', '', null]) {
      const phase = validPhase();
      phase.status = bad;
      assert.throws(() => validatePhase(phase, filename, milestones), /status must be one of/, `status=${String(bad)}`);
    }
    for (const good of ['todo', 'in_progress', 'completed', 'failed']) {
      const phase = validPhase();
      phase.status = good;
      assert.doesNotThrow(() => validatePhase(phase, filename, milestones), `status=${good}`);
    }
  });

  test('next_ids must contain exactly {source, task, change}', () => {
    const phase = validPhase();
    phase.next_ids = { source: 1, task: 1 };
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid phase next_ids fields/);
    phase.next_ids = { source: 1, task: 1, change: 1, extra: 1 };
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid phase next_ids fields/);
  });

  test('timestamps must be ISO 8601', () => {
    const phase = validPhase();
    phase.created_at = 'yesterday';
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid ISO 8601 timestamp/);
  });

  test('source_trace items require milestone_id (prompt claim)', () => {
    const phase = validPhase();
    phase.source_trace.push({ id: 'source-001', location: 'a.md', claim: 'c' });
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid phase source trace fields/);
  });

  test('source_trace item milestone_id must exist', () => {
    const phase = validPhase();
    phase.source_trace.push({ id: 'source-001', milestone_id: 'milestone-999', location: 'a.md', claim: 'c' });
    assert.throws(() => validatePhase(phase, filename, milestones), /phase source references missing milestone/);
  });

  test('task items require {id, title, detail, status, progress}', () => {
    const phase = validPhase();
    phase.tasks.push({ id: 'task-001', title: 'T', detail: 'D', status: 'todo', progress: [] });
    phase.next_ids.task = 2;
    assert.doesNotThrow(() => validatePhase(phase, filename, milestones));
    phase.tasks.push({ id: 'task-002', title: 'T2' });
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid task fields/);
  });

  test('progress entries require {timestamp, message}', () => {
    const phase = validPhase();
    phase.tasks.push({ id: 'task-001', title: 'T', detail: 'D', status: 'todo', progress: [{ timestamp: '2026-09-18T08:00:00Z', message: 'm' }] });
    phase.next_ids.task = 2;
    assert.doesNotThrow(() => validatePhase(phase, filename, milestones));
    phase.tasks[0].progress.push({ timestamp: '2026-09-18T08:00:00Z' });
    assert.throws(() => validatePhase(phase, filename, milestones), /invalid progress fields/);
  });

  test('change request decision must be requested|approved|rejected', () => {
    const phase = validPhase();
    phase.change_request_log.push({
      id: 'change-001',
      timestamp: '2026-09-18T08:00:00Z',
      summary: 's',
      reason: 'r',
      affected_ids: ['task-001'],
      decision: 'maybe',
      evidence: null,
    });
    assert.throws(() => validatePhase(phase, filename, milestones), /change decision must be requested, approved, or rejected/);
  });

  test('change request affected_ids must reference IDs in the phase', () => {
    const phase = validPhase();
    phase.tasks.push({ id: 'task-001', title: 'T', detail: 'D', status: 'todo', progress: [] });
    phase.next_ids.task = 2;
    phase.change_request_log.push({
      id: 'change-001',
      timestamp: '2026-09-18T08:00:00Z',
      summary: 's',
      reason: 'r',
      affected_ids: ['task-999'],
      decision: 'requested',
      evidence: null,
    });
    phase.next_ids.change = 2;
    assert.throws(() => validatePhase(phase, filename, milestones), /change references missing ID/);
  });

  test('next_ids counters must exceed existing IDs', () => {
    const phase = validPhase();
    phase.next_ids = { source: 1, task: 1, change: 1 };
    phase.tasks.push({ id: 'task-001', title: 'T', detail: 'D', status: 'todo', progress: [] });
    assert.throws(() => validatePhase(phase, filename, milestones), /next_ids.task must exceed existing IDs/);
  });
});

describe('build-feature-plan prompt: shape vs example phase file', () => {
  test('example phase_1.json passes validatePhase', () => {
    const phase = JSON.parse(fs.readFileSync(SAMPLE_PHASE, 'utf8'));
    const milestoneIds = new Set(['milestone-001', 'milestone-002', 'milestone-003']);
    assert.doesNotThrow(() => validatePhase(phase, SAMPLE_PHASE, milestoneIds));
    assert.deepEqual(Object.keys(phase).sort(), [...EXPECTED_PHASE_FIELDS].sort());
  });

  test('example timeline passes validateTimeline (validateChange is internal; covered transitively)', () => {
    const timelinePath = path.join(ROOT, 'examples', 'sample-project', '.mandor', 'plans', 'milestone-timeline.json');
    const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    assert.doesNotThrow(() => validateTimeline(timeline));
    // Change-request validation runs inside validateTimeline -> validateChange.
    // Each change entry must already satisfy the documented shape (id, timestamp,
    // summary, reason, affected_ids, decision, evidence). The example timeline
    // passes, so the contract holds.
  });
});

describe('build-feature-plan prompt: PMError contract', () => {
  test('PMError is exported', () => {
    assert.equal(typeof PMError, 'function');
    const err = new PMError('x');
    assert.equal(err.message, 'x');
    assert.ok(err instanceof Error);
  });
});
