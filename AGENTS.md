# mandor — AGENTS

Portable Node.js skill package. No `package.json`, no lint/typecheck/formatter config, no CI, no `.gitignore`. Everything below is hard-won context.

## What this repo is

CLI + prompt package managing a project's lifecycle artifacts under `<project-path>/.mandor/`. Stages: `client-discovery` → `requirements` → `plans`. See `SKILL.md` for full route map and `README.md` for install/use.

Entry points:
- CLI wrapper: `bin/mandor` (shells out to node)
- CLI impl: `scripts/mandor.js` (~42 KB; exports `validatePhase`, `validateTimeline`, `PMError` — tests import these directly)
- Dashboard: `scripts/dashboard-server.js` (live HTTP)
- One-shot migration helper: `scripts/migrate-artifact-dir.js` (`.project-manager` → `.mandor`)

## Commands

```sh
# install into a skills dir (refuses symlink path components)
sh install.sh --destination ~/.config/opencode/skills   # or omit flag if exactly one exists
sh install.sh --destination PATH --force                # overwrite existing

# run CLI directly (PATH setup is optional; wrapper execs node anyway)
./bin/mandor --help
node scripts/mandor.js --project PATH init

# live dashboard (polls /api/data every 1s)
node scripts/mandor.js dashboard --port 4173   # scans cwd + parents for .mandor/
```

## Tests

Pure `node:test`, no jest/mocha, no `npm test`:

```sh
node --test test/                   # all suites
node --test test/mandor.test.js     # single file
```

Globbing via `node --test test/` may not discover files in some Node versions — run files explicitly when it fails. Each test creates a `mkdtemp` project dir, no fixtures on disk.

## Lifecycle rules (read carefully)

- **JSON CRUD is CLI-only.** Never hand-edit `.mandor/*.json`. Every successful mutation atomically validates the full doc. Reads do not mutate.
- **Hard approval gates.** Brief approval gates requirements. Final approval gates plans. Never auto-advance past a gate. Sub-prompts prefixed `-` own their own stop condition.
- **Phases delete only with `--force`** and only when empty; milestone init refuses overwrite without `--force`. Plan init is idempotent and preserves existing phase files.
- **Statuses** (exact strings): `todo`, `in_progress`, `completed`, `failed`.
- **Plan names**: lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- **Filenames fixed**: `BRD.md`, `PRD.md`, `US-NNN-<slug>.md`, `wf_<n>.html`, `phase_N.json`, `milestone-timeline.json`.
- **Timestamps**: ISO 8601 (`YYYY-MM-DDTHH:MM:SS[.fff][Z|±HH:MM]`).
- **ID prefixes**: `source-NNN`, `milestone-NNN`, `wbs-NNN`, `risk-NNN`, `change-NNN`, `task-NNN`. `next_ids` must exceed existing max.
- **Path safety**: CLI rejects writes outside project root and refuses symlinked path components. `install.sh` enforces the same on destination.

## Conventions that diverge from defaults

- No npm. Add deps only if required; if you do, document the install path in `SKILL.md`.
- Markdown artifacts (brief, BRD, PRD, stories, wireframes) are normal files; JSON is not.
- Dashboard HTML reads Tailwind, `<md-block>`, `marked`, and DOMPurify from CDNs — needs network. Wireframes render in sandboxed iframes, no `allow-scripts`.
- Legacy static `.mandor` HTML dashboards are obsolete and ignored; use `mandor dashboard` instead.
- NDA content in examples is a draft, not legal advice — preserve that framing if reusing snippets.

## When touching code

- Validators live inline in `scripts/mandor.js` (`validateTimeline`, `validatePhase`, helpers). Tests import them — keep exports stable.
- Prompt filenames prefixed `-` sort after their router; new sub-prompts must follow that pattern.
- Schema versions are pinned (`1.0`). Bumping requires a migration plan, not a silent change.
- Releasing: bump `metadata.version` in `SKILL.md` frontmatter to match commit intent.

## Operational gotchas

- `install.sh` aborts on symlink path components anywhere in the destination or target tree — re-check after `ln -s`-adjacent tooling.
- Wrapper shell script `bin/mandor` has the `x` bit set by `install.sh`; fresh clones need `chmod +x bin/mandor` if you bypass install.
- Multiple `skills` dirs present → `install.sh` errors with "Ambiguous destination"; create exactly one or pass `--destination` explicitly.
- `mandor dashboard` re-reads all artifacts on every `/api/data` poll and renders Markdown client-side via `<md-block>`; JSON and Markdown edits both appear within ~1s. Only edits to the dashboard template itself need a server restart.
