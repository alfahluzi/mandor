'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'scripts', 'mandor.js');

const run = (dir, args) => spawnSync(process.execPath, [CLI, '--project', dir, ...args], { encoding: 'utf8' });

function createProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandor-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function initTimeline(t) {
  const dir = createProject(t);
  assert.equal(run(dir, ['init']).status, 0);
  assert.equal(run(dir, ['milestone', 'init', '--name', 'k', '--version', '0.1.0']).status, 0);
  return dir;
}

function initPlan(t) {
  const dir = initTimeline(t);
  assert.equal(run(dir, ['milestone', 'add-milestone', '--name', 'M1']).status, 0);
  assert.equal(run(dir, ['milestone', 'approve', '--status', 'approved']).status, 0);
  assert.equal(run(dir, ['plan', 'init', 'my-plan']).status, 0);
  assert.equal(run(dir, ['plan', 'add-phase', 'my-plan', '--phase', '1', '--milestone-id', 'milestone-001', '--title', 'Phase 1']).status, 0);
  assert.equal(run(dir, ['plan', 'add-task', 'my-plan', '--phase', '1', '--title', 'T', '--detail', 'D']).status, 0);
  return dir;
}

describe('mandor regressions', () => {
  test('add-risk without --mitigation/--owner succeeds with safe defaults', (t) => {
    const dir = initTimeline(t);

    const human = run(dir, ['milestone', 'add-risk', '--description', 'ship-delay risk']);
    assert.equal(human.status, 0, human.stderr);
    assert.doesNotMatch(human.stderr, /mitigation must be non-empty text/);
    assert.match(human.stdout, /not yet mitigated/);
    assert.match(human.stdout, /unassigned/);

    const jsonDir = createProject(t);
    assert.equal(run(jsonDir, ['init']).status, 0);
    assert.equal(run(jsonDir, ['milestone', 'init', '--name', 'k', '--version', '0.1.0']).status, 0);
    const json = run(jsonDir, ['--json', 'milestone', 'add-risk', '--description', 'ship-delay risk']);
    assert.equal(json.status, 0, json.stderr);
    const result = JSON.parse(json.stdout);
    assert.equal(result.risk_register[0].mitigation, 'not yet mitigated');
    assert.equal(result.risk_register[0].owner, 'unassigned');
  });

  test('update-task without TASK_ID reports missing item ID, not "not found: my-plan"', (t) => {
    const dir = initPlan(t);

    const result = run(dir, ['plan', 'update-task', 'my-plan', '--phase', '1', '--title', 'renamed']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /an item ID \(SOURCE_ID\/TASK_ID\/CHANGE_ID\) is required/);
    assert.doesNotMatch(result.stderr, /not found: my-plan/);
  });

  test('update-task with explicit --task-id still updates the task', (t) => {
    const dir = initPlan(t);

    const result = run(dir, ['plan', 'update-task', 'my-plan', '--phase', '1', '--task-id', 'task-001', '--title', 'renamed']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /renamed/);
  });
});
