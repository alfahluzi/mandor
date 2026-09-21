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
prompt and `examples/sample-project/.mandor/`. Resolve `<skill-dir>/bin/mandor`
relative to this file. Use that CLI for every managed JSON read/list/create/update/
delete. Never manually read or edit managed JSON during CRUD. Markdown uses normal
filesystem operations.

## Routes

Every prompt under `prompts/` is wired below. Sub-prompts prefixed `-`
alphabetically sort after their router. Lifecycle gates stop a route at its
own approval boundary; the router never auto-advances.

### Client Discovery (`prompts/client-discovery/`)

| File | Role | Purpose | Output |
|---|---|---|---|
| [`client-discovery.md`](prompts/client-discovery/client-discovery.md) | router | Entry for every discovery request. Dispatches by intent, owns the twelve-section `client-brief.md` schema, gates approval. | brief approval gate |
| [`-greenfield-project.md`](prompts/client-discovery/-greenfield-project.md) | sub-route | New product, presales, client intake. Interviews iteratively, fills the brief. | `.mandor/client-discovery/client-brief.md` |
| [`-existing-project.md`](prompts/client-discovery/-existing-project.md) | sub-route | Inspect existing repo / service. Updates the brief in place from observed behavior. | `.mandor/client-discovery/client-brief.md` |

### Requirements (`prompts/requirements/`)

| File | Role | Purpose | Output |
|---|---|---|---|
| [`build-requirement-docs.md`](prompts/requirements/build-requirement-docs.md) | router | Entry for requirements after brief approval. Drives the four-step sequential pipeline. | final approval gate |
| [`-build-brd.md`](prompts/requirements/-build-brd.md) | step 1 | Build Business Requirements Document from approved brief. | `requirements/BRD.md` |
| [`-build-prd.md`](prompts/requirements/-build-prd.md) | step 2 | Build Product Requirements Document from approved BRD. Tags MoSCoW. | `requirements/PRD.md` |
| [`-build-user-stories.md`](prompts/requirements/-build-user-stories.md) | step 3 | Materialize approved PRD into `US-NNN` stories. | `requirements/user-stories/US-NNN-<slug>.md` |
| [`-build-wireframe.md`](prompts/requirements/-build-wireframe.md) | step 4 | Render low-fidelity HTML wireframes for stories with UI dependencies. | `requirements/wireframes/wf_<n>.html` |

### Plans (`prompts/plans/`)

| File | Role | Purpose | Output |
|---|---|---|---|
| [`build-milestone.md`](prompts/plans/build-milestone.md) | milestone | Inspect approved requirements, build timeline + WBS + risk register via CLI. Approval gate. | `plans/milestone-timeline.json` |
| [`build-feature-plan.md`](prompts/plans/build-feature-plan.md) | phase | Detailed phase plan with tasks, source traces, change requests via CLI. | `plans/<plan>/phase_N.json` |
| [`execute-plan.md`](prompts/plans/execute-plan.md) | execution | Sequential plan execution with status, progress, change log via CLI. | executed / skipped / failed IDs |

### Lifecycle gates

```
client-discovery ──brief approval──▶ requirements ──final approval──▶ plans ──execute
       ▲                                  │                                │
       │                                  │ steps 1→4 in order            │ phases in order
       └──────────── re-open on rejection ─┴────────────────────────────────┘
```

Every transition is a hard gate requiring explicit approval. The router only
verifies the prior artifact exists and is approved; the sub-prompt owns its
own approval stop condition and names its next route.

## Rules

Resolve the project path. Preserve evidence, stable IDs, progress, completed state,
and unrelated content. Use ISO 8601 timestamps, lowercase kebab-case plan names,
fixed `BRD.md`/`PRD.md`, and statuses `todo`, `in_progress`, `completed`, `failed`.
Approval requires explicit user approval. Stop at lifecycle gates. CLI mutations
atomically validate managed JSON; reads do not mutate.

## Live dashboard

For development, run a live HTTP dashboard that polls `/api/data` every second.
The server re-reads the artifact tree on each poll, so both JSON and Markdown
changes from CLI mutations appear automatically within about a second. Markdown
is rendered client-side by `<md-block>`, sanitized via its `untrusted` attribute.
Only edits to the dashboard template itself require restarting the server.

```sh
mandor dashboard --port 4173
# or directly:
mandor dashboard --project <project-path> --port 4173
```

Endpoints: `GET /` (HTML), `GET /api/data` (artifact JSON), `GET /api/health`,
`GET /raw/<path>` (path-safe raw files). Press Ctrl+C to stop.

## Setup

Add the skill's wrapper to PATH so every command below can be invoked as a bare
`mandor ...` instead of a full path to `<skill-dir>/bin/mandor`:

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

### If `mandor` is not working

The bare `mandor` keyword only works after PATH setup above. If the command
fails with `command not found` or behaves unexpectedly, walk through this in
order before retrying:

1. **Verify the wrapper exists.** `<skill-dir>/bin/mandor` must be an
   executable shell script. Run `ls -l <skill-dir>/bin/mandor` and confirm the
   `x` bit. If missing or not executable, re-run `install.sh` from the skill
   directory.
2. **Verify PATH contains `<skill-dir>/bin` for the current shell.**
   `echo "$PATH" | tr ':' '\n' | grep -F "<skill-dir>/bin"` must print the
   path. If not, the `export` from setup only applies to that one shell;
   re-export or move it into `~/.bashrc` / `~/.zshrc`.
3. **Verify resolution.** `command -v mandor` (POSIX) or `which mandor` must
   print `<skill-dir>/bin/mandor`. If it prints something else, a different
   `mandor` binary is shadowing it; fix PATH order so `<skill-dir>/bin` comes
   first, or call the wrapper by absolute path.
4. **Sanity-check the CLI.** `mandor --help` must list the subcommands
   (`dashboard`, CRUD verbs). If it errors, run
   `node <skill-dir>/bin/mandor --help` to see the underlying Node error and
   confirm Node.js 18+ is installed (`node --version`).
5. **Bypass the wrapper when needed.** Any `mandor <subcommand> ...` example
   in this skill can be invoked as `<skill-dir>/bin/mandor <subcommand> ...`
   or `node <skill-dir>/bin/mandor <subcommand> ...` without PATH setup.

Until at least step 2 succeeds, do not assume `mandor` is on PATH; prefer the
absolute-path form to avoid silent command-not-found failures.

Runtime layout:

```text
<project>/.mandor/
  client-discovery/  requirements/  plans/
  plans/milestone-timeline.json
  plans/<plan-name>/phase_N.json
```

JSON CRUD is CLI-only. Markdown artifacts remain ordinary files. NDA content is a
draft requiring legal review, never legal advice.
