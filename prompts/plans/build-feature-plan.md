# Build Feature Plan

Use `<skill-dir>/bin/mandor` for every plan, phase, task, source, and
change mutation. Use normal filesystem operations only for Markdown.
Managed JSON stays CLI-only.

## Purpose

Convert approved requirements into a feature-scoped execution plan. One
phase per feature. Tasks inside each phase decompose that feature into
buildable units anchored to approved user stories.

## Entry criteria

Use only after both gates have passed:

1. Approved requirements pipeline — verify each of these exists at
   `<project-path>` and is marked approved in `.mandor/`:
   - `requirements/BRD.md`
   - `requirements/PRD.md`
   - `requirements/user-stories/US-NNN-<slug>.md` (all `must` and
     `should` stories)
   - `requirements/wireframes/wf_<n>.html` when any approved story
     depends on UI; skip cleanly when the project is headless.
2. Approved milestone timeline — verify `.mandor/plans/milestone-timeline.json`
   has `approval.status = approved`. Read milestones, WBS work packages,
   risks, and source trace for context.

Do not proceed if any gate is unmet. State which gate blocked.

## What counts as a feature

A feature is a coherent user-visible capability that:

- Groups one or more approved user stories whose `feature` metadata
  field matches.
- Falls inside a single milestone from the approved timeline and maps
  to exactly one WBS work package under that milestone.
- Carries a stable kebab-case slug, used as the phase title and as the
  plan slug. Slugs must be unique inside the plan.

Stories that share a feature but miss the `feature` metadata are
promoted to `[open]` in the Open Questions section — never silently
bucketed. Stories outside the approved scope (`could`, `won't`) are
deferred and tracked as `[decision]` deferred items, not as phases.

## Phase JSON contract

Each phase file at `.mandor/plans/<plan-slug>/phase_<N>.json` matches
the example at
`examples/sample-project/.mandor/plans/toko-online/phase_1.json`.
Supported fields, exact set:

| Field | Type | Source |
|---|---|---|
| `schema_version` | `"1.0"` | CLI default |
| `plan_name` | string (kebab-case) | CLI default = plan slug |
| `phase_number` | integer | CLI argument `--phase N` |
| `milestone_id` | `milestone-NNN` | CLI `--milestone-id` |
| `title` | string (feature slug) | CLI `--title` |
| `status` | `todo` \| `in_progress` \| `completed` \| `failed` | CLI `--status` (default `todo`) |
| `created_at` | ISO 8601 | CLI default (now) |
| `updated_at` | ISO 8601 | CLI default (now) |
| `next_ids` | `{ source, task, change }` integers | CLI default |
| `source_trace` | array (see below) | CLI `add-source` |
| `tasks` | array (see below) | CLI `add-task` |
| `change_request_log` | array (see below) | CLI `add-change` |

Field shape per item:

- `source_trace[]`: `{ id, milestone_id, location, claim }`. IDs are
  zero-padded `source-NNN`, auto-assigned per phase. `milestone_id` is
  required and must reference an existing milestone.
- `tasks[]`: `{ id, title, detail, status, progress }`. IDs are
  zero-padded `task-NNN`. `progress[]` is append-only with shape
  `{ timestamp, message }`; use `update-progress --index` to edit.
- `change_request_log[]`: `{ id, timestamp, summary, reason,
  affected_ids, decision, evidence }`. `affected_ids` is a list of text
  IDs referencing other items inside the phase. `decision` is one of
  `requested`, `approved`, `rejected`. `evidence` is text or `null`.

Do not invent extra fields. The CLI validates and writes JSON atomically
on every write; no dashboard file is generated.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm both gates.
   List approved story IDs grouped by `feature` metadata, plus any
   story missing that field.
2. Read the timeline end-to-end. For every feature you plan to add,
   record the milestone ID and WBS work package ID it derives from.
   Reject features that lack a milestone or WBS parent.
3. Read the approved requirements artifacts end-to-end. Build a
   per-feature source trace: each claim points to the story ID(s), the
   PRD functional requirement ID, and the BRD requirement ID it
   derives from.
4. Choose a plan slug. Lowercase kebab-case. Prefer `<product>-features`
   unless the timeline name already provides one. Initialize with
   `plan init`.
5. For each approved feature:
   1. `add-phase --phase N --milestone-id milestone-NNN --title <slug>
      --status todo`. The CLI writes the full phase skeleton
      (`schema_version`, `plan_name`, `phase_number`, timestamps,
      `next_ids`, empty `source_trace`/`tasks`/`change_request_log`).
   2. Add one task per story the feature owns: `add-task --phase N
      --title "<US-NNN> <story title>" --detail "<story slug + scope
      summary>"`. The CLI sets `task-NNN`, `status: todo`, empty
      `progress`.
   3. Add setup / shared tasks only when a feature clearly needs them
      (data model, auth gating, telemetry). One task per real unit, no
      filler.
   4. Add `source_trace` entries for every PRD + BRD requirement the
      feature satisfies: `add-source --phase N --milestone-id
      milestone-NNN --location <path#section> --claim "<text>"`.
6. Record scope shifts through `add-change --phase N --summary --reason
   --affected-id <id>... --decision requested --evidence <text|null>`
   only when the plan diverges from an approved artifact. Reference
   affected story, PRD, BRD, and task IDs in `--affected-id`. CLI builds
   the `affected_ids` list and assigns the `change-NNN` id plus
   `timestamp`.
7. Filename discipline: plan directory is `.mandor/plans/<plan-slug>/`;
   phase file is `phase_<phase_number>.json`. Phase number equals the
   phase ID and must match the filename or the CLI rejects it.

## Per-feature checklist

Before issuing `add-phase`, confirm every box:

- [ ] Feature slug is unique inside the plan.
- [ ] At least one approved `must` or `should` story maps to it.
- [ ] Exactly one approved milestone from the timeline owns it.
- [ ] Exactly one WBS work package from the timeline covers it.
- [ ] Source trace cites every PRD functional requirement and BRD
      requirement the feature satisfies.

If any box fails, hold the feature and surface it in Open Questions.

## Output

Return:

- Plan slug and phase file paths under `.mandor/plans/<plan-slug>/`.
- Feature list: phase number, title, milestone ID, WBS ID, story IDs
  mapped, source gaps, deferred (`could`/`won't`) story IDs.
- CLI JSON output for every mutation.
- Open questions, assumptions, and the exact approval needed.

After every mutation, the CLI validates and writes JSON atomically; no
dashboard file is generated. No manual edits to managed JSON. To view
artifacts after any Markdown change, start the live dashboard with
`mandor dashboard` (the dashboard re-reads artifacts on every poll (~1s), so
JSON and Markdown changes appear automatically within about a second; no
restart or manual refresh is needed).

## Stop condition

Request explicit approval of the feature plan, then stop. State which
milestone each feature lives under and which stories it consumes. After
approval, the next required step is sequential execution in a new
session routed to [`execute-plan.md`](execute-plan.md).
