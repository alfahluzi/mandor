---
name: "mandor"
description: "Manage project discovery, milestones, phases, tasks, execution, and artifacts."
license: "MIT"
compatibility: "Node.js 18+ for the portable mandor CLI and dashboard."
metadata:
  version: "2.0"
---

# Mandor

Manage artifacts under `<project-path>/.mandor/`. Load the matching
prompt and `references/artifact-contracts.md`. Resolve `<skill-dir>/bin/mandor`
relative to this file. Use that CLI for every managed JSON read/list/create/update/
delete. Never manually read or edit managed JSON during CRUD. Markdown uses normal
filesystem operations.

## Routes

- New Project Discovery: [discover-greenfield-project](prompts/discover-greenfield-project.md)
- Existing project Discovery: [discover-existing-project](prompts/discover-existing-project.md)
- Requirements: [build-requirement-docs](prompts/build-requirement-docs.md)
- Milestones: [build-project-plan](prompts/build-project-plan.md)
- Phases: [build-phase-plan](prompts/build-phase-plan.md)
- Execution: [execute-plan](prompts/execute-plan.md)

## Rules

Resolve the project path. Preserve evidence, stable IDs, progress, completed state,
and unrelated content. Use ISO 8601 timestamps, lowercase kebab-case plan names,
fixed `BRD.md`/`PRD.md`, and statuses `todo`, `in_progress`, `completed`, `failed`.
Approval requires explicit user approval. Stop at lifecycle gates. CLI mutations
atomically validate JSON and regenerate `.mandor/pm.html`; reads do not
mutate.

## Live dashboard

For development, run a live HTTP dashboard that polls `/api/data` every second and
auto-refreshes the JSON view. Markdown is pre-rendered to HTML once at startup.
JSON changes from any CLI mutation appear immediately on next poll; Markdown
changes need a restart (or hit `/api/rerender`).

```sh
mandor dashboard --port 4173
# or directly:
node <skill-dir>/scripts/dashboard-server.js --project <project-path> --port 4173
```

Endpoints: `GET /` (HTML), `GET /api/data` (snapshot), `GET /api/health`,
`GET /api/rerender`, `GET /raw/<path>` (path-safe raw files). Press Ctrl+C to stop.

## Setup

Add the skill's wrapper to PATH so every command below can be invoked as a bare
`mandor ...` instead of a full path to `scripts/mandor.js`:

```sh
export PATH="<skill-dir>/bin:$PATH"
```

`<skill-dir>` is the directory containing this `SKILL.md` (after `install.sh`,
typically `~/.config/opencode/skills/mandor`). The wrapper is a shell
script that execs the bundled Node CLI; verify with `which mandor` and
`mandor --help`. Without PATH setup, call the wrapper directly:

```sh
<skill-dir>/bin/mandor --help
```

Manual dashboard generation:

```sh
node <skill-dir>/scripts/generate-pm-dashboard.js <project-path>
```

Runtime layout:

```text
<project>/.mandor/
  client-discovery/  requirements/  plans/
  plans/milestone-timeline.json
  plans/<plan-name>/phase_N.json
  pm.html
```

JSON CRUD is CLI-only. Markdown artifacts remain ordinary files. NDA content is a
draft requiring legal review, never legal advice.
