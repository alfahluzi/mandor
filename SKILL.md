---
name: "project-manager"
description: "Manage project discovery, milestones, phases, tasks, execution, and artifacts."
license: "MIT"
compatibility: "Node.js 18+ for the portable project-manager CLI and dashboard."
metadata:
  version: "2.0"
---

# Project Manager

Manage artifacts under `<project-path>/.project-manager/`. Load the matching
prompt and `references/artifact-contracts.md`. Resolve `<skill-dir>/bin/project-manager`
relative to this file. Use that CLI for every managed JSON read/list/create/update/
delete. Never manually read or edit managed JSON during CRUD. Markdown uses normal
filesystem operations.

## Routes

- Discovery: [discovery-presales](prompts/discovery-presales.md)
- Existing project: [discover-existing-project](prompts/discover-existing-project.md)
- Requirements: [build-requirement-docs](prompts/build-requirement-docs.md)
- Milestones: [build-project-plan](prompts/build-project-plan.md)
- Phases: [build-phase-plan](prompts/build-phase-plan.md)
- Execution: [execute-plan](prompts/execute-plan.md)

## Rules

Resolve the project path. Preserve evidence, stable IDs, progress, completed state,
and unrelated content. Use ISO 8601 timestamps, lowercase kebab-case plan names,
fixed `BRD.md`/`PRD.md`, and statuses `todo`, `in_progress`, `completed`, `failed`.
Approval requires explicit user approval. Stop at lifecycle gates. CLI mutations
atomically validate JSON and regenerate `.project-manager/pm.html`; reads do not
mutate.

## Setup

Add the skill's wrapper to PATH so every command below can be invoked as a bare
`project-manager ...` instead of a full path to `scripts/project-manager.js`:

```sh
export PATH="<skill-dir>/bin:$PATH"
```

`<skill-dir>` is the directory containing this `SKILL.md` (after `install.sh`,
typically `~/.config/opencode/skills/project-manager`). The wrapper is a shell
script that execs the bundled Node CLI; verify with `which project-manager` and
`project-manager --help`. Without PATH setup, call the wrapper directly:

```sh
<skill-dir>/bin/project-manager --help
```

Manual dashboard generation:

```sh
node <skill-dir>/scripts/generate-pm-dashboard.js <project-path>
```

Runtime layout:

```text
<project>/.project-manager/
  client-discovery/  requirements/  plans/
  plans/milestone-timeline.json
  plans/<plan-name>/phase_N.json
  pm.html
```

JSON CRUD is CLI-only. Markdown artifacts remain ordinary files. NDA content is a
draft requiring legal review, never legal advice.
