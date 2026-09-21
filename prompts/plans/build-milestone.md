# Build Milestone Plan

Use `<skill-dir>/bin/mandor` for every timeline JSON read, list, and
mutation. Use normal filesystem operations only for Markdown.

## Purpose

Convert all approved requirements artifacts into a milestone timeline
plus work-breakdown structure (WBS) and risk register. One milestone per
delivery slice. Work packages inside the WBS describe the chunks of work
that ship inside each milestone; tasks belong to plans, not milestones.

## Entry criteria

Use only after the requirements lifecycle has fully approved every gate.
Verify each artifact exists at `<project-path>` and is marked approved in
`.mandor/`:

1. `client-discovery/client-brief.md` — approved.
2. `requirements/BRD.md` — approved, with requirement IDs.
3. `requirements/PRD.md` — approved, with MoSCoW-tagged functional
   requirements.
4. `requirements/user-stories/US-NNN-<slug>.md` — every `must` and
   `should` story approved.
5. `requirements/wireframes/wf_<n>.html` — every UI-dependent story has
   an approved wireframe. Skip cleanly when the project is headless.

Do not proceed if any gate is unmet. State which gate blocked and which
artifact is missing or unapproved.

## What counts as a milestone

A milestone is a coherent delivery slice that:

- Groups one or more approved user stories whose `milestone` metadata
  field matches the milestone name.
- Carries a stable kebab-case ID auto-assigned by `milestone add-milestone`
  (`milestone-NNN`).
- Carries only ID, name, status (`todo|in_progress|completed|failed`),
  start timestamp, and target timestamp. No tasks, no acceptance
  criteria, no completion dates invented by the prompt.
- Owns one or more WBS work packages via `milestone add-wbs`. Work
  packages describe scope, not work units — tasks live in plans.

Stories that reference no milestone are promoted to `[open]` in Open
Questions. Stories outside the approved scope (`could`, `won't`) are
deferred and tracked as `[decision]` change-log entries, not milestones.

## JSON shape contract

`plans/milestone-timeline.json` is fixed by the schema. Do not invent
fields, rename keys, or nest extra objects. The CLI validates on every
write and rejects drift.

```json
{
  "schema_version": "1.0",
  "name": "<kebab-project-name>",
  "version": "<semver>",
  "created_at": "<ISO 8601 UTC>",
  "updated_at": "<ISO 8601 UTC>",
  "next_ids": {
    "source": 1,
    "milestone": 1,
    "wbs": 1,
    "risk": 1,
    "change": 1
  },
  "approval": {
    "status": "requested|approved|rejected",
    "timestamp": "<ISO 8601 UTC>",
    "evidence": "<path or null>"
  },
  "source_trace": [
    { "id": "source-NNN", "location": "<path#anchor or url>", "claim": "<one sentence>" }
  ],
  "milestones": [
    {
      "id": "milestone-NNN",
      "name": "<Milestone name>",
      "status": "todo|in_progress|completed|failed",
      "start_timestamp": "<ISO 8601 UTC>",
      "target_timestamp": "<ISO 8601 UTC>"
    }
  ],
  "wbs": [
    { "id": "wbs-NNN", "milestone_id": "milestone-NNN", "name": "<scope slice>" }
  ],
  "risk_register": [
    {
      "id": "risk-NNN",
      "description": "<what can go wrong>",
      "likelihood": "low|medium|high|unknown",
      "impact": "low|medium|high|unknown",
      "mitigation": "<plan or 'not yet mitigated'>",
      "owner": "<role or 'unassigned'>",
      "status": "open|mitigated|accepted|closed"
    }
  ],
  "change_request_log": [
    {
      "id": "change-NNN",
      "timestamp": "<ISO 8601 UTC>",
      "summary": "<what changed>",
      "reason": "<why>",
      "affected_ids": ["milestone-NNN", "wbs-NNN", ...],
      "decision": "approved|rejected|deferred",
      "evidence": "<path or null>"
    }
  ]
}
```

Hard rules:

- IDs auto-increment via `next_ids`. Never hand-author `source-NNN`,
  `milestone-NNN`, `wbs-NNN`, `risk-NNN`, or `change-NNN`.
- `milestones[].status` is the only mutable execution field. Do not
  add `progress`, `acceptance_criteria`, `dependencies`, or `notes`.
- `wbs` references a milestone by `milestone_id`; never by name.
- `risk_register.likelihood` / `impact` accept `unknown` until assessed.
- `change_request_log.affected_ids` may reference `milestone-NNN`,
  `wbs-NNN`, or story/PRD/BRD IDs from the requirements artifacts.
- `approval.evidence` must be a path or URL; use `null` only when no
  artifact backs the approval.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm every entry
   criterion. Reject if any gate is unmet.
2. Run `mandor init` if `.mandor/` is missing. Run
   `mandor milestone init --name <kebab-name> --version <semver>` to
   create `plans/milestone-timeline.json`. Reuse an existing timeline
   when one is present; never overwrite silently. Use `--force` only
   after explicit user confirmation.
3. Read the approved artifacts end-to-end: brief, BRD, PRD, every
   approved story, every approved wireframe. Build a source trace: each
   milestone and WBS entry must cite the story IDs, PRD functional
   requirement IDs, and BRD requirement IDs it derives from. Add the
   entries with `mandor milestone add-source --location --claim`.
4. Group approved `must` and `should` stories by their `milestone`
   metadata field. Each distinct milestone label becomes one
   `mandor milestone add-milestone --name --status todo` call. Order
   milestones by dependency: foundations first, integrations last.
5. Assign start and target timestamps in ISO 8601 UTC. Derive them from
   scope size and explicit dependencies; never invent completion dates.
   Use `--start` and `--target` flags on `add-milestone` or
   `update-milestone`.
6. For each milestone, add WBS work packages via
   `mandor milestone add-wbs --milestone-id --name`. One WBS entry per
   coherent feature slice inside the milestone. Keep names action-shaped
   and stable; the next route (`build-feature-plan.md`) reads them by ID.
7. Capture risks with `mandor milestone add-risk --description` plus
   `--likelihood`, `--impact`, `--mitigation`, `--owner`, `--risk-status`.
   Pull from the BRD/PRD risk sections and from any new risks the
   milestone structure surfaces (cross-team coordination, dependency
   churn, scope ambiguity).
8. Record scope shifts through `mandor milestone add-change --summary
   --reason` with `--affected-id` referencing the story, PRD, and BRD
   IDs impacted. Use `--decision` to capture acceptance/rejection and
   `--evidence` for the cited artifact path.
9. Do not invent approvals, dependencies between milestones, acceptance
   criteria, or completion dates. Supported JSON fields remain the
   milestone timeline schema documented in `mandor milestone --help`.
10. When every milestone, WBS entry, risk, and source trace is in
    place, request approval via
    `mandor milestone approve --status requested --evidence <artifact
    paths>`. After explicit user approval, re-run with
    `--status approved`.

## Per-milestone checklist

Before requesting approval, confirm every box:

- [ ] Every approved `must` and `should` story is mapped to exactly one
      milestone.
- [ ] Every milestone carries at least one WBS work package.
- [ ] Every WBS entry references the milestone that owns it.
- [ ] Every milestone, WBS, and risk has a source-trace entry citing
      story, PRD, and BRD IDs.
- [ ] No `could`/`won't` story is treated as a milestone deliverable.
- [ ] No invented timestamps, IDs, or acceptance criteria exist.

If any box fails, hold the milestone and surface it in Open Questions.

## Output

Return:

- Timeline file path: `.mandor/plans/milestone-timeline.json`.
- Milestone list with IDs, names, start, target, status.
- WBS list with IDs, parent milestone IDs, names.
- Risk register summary with ID, description, likelihood, impact,
  mitigation, owner, status.
- Source-trace entry IDs and their claim summaries.
- CLI JSON output for every mutation.
- Open questions, assumptions, deferred story IDs, and the exact
  approval needed.

After every mutation, the CLI validates and writes JSON atomically; no
dashboard file is generated. No manual edits to managed JSON. To view
artifacts after any Markdown change, start the live dashboard with
`mandor dashboard` (the dashboard re-reads artifacts on every poll (~1s), so
JSON and Markdown changes appear automatically within about a second; no
restart or manual refresh is needed).

## Stop condition

Request explicit approval of the milestone timeline, then stop. After
approval, the next required step is detailed phase planning in a new
session routed to [`build-feature-plan.md`](build-feature-plan.md).
