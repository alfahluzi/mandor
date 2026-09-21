# Build User Stories

## Entry criteria

Use only after `PRD.md` has been approved. Verify approval status before
proceeding. Source-of-truth is the approved PRD; BRD and brief are
back-reference.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm PRD approval and
   collect every `must` and `should` functional requirement.
2. Read PRD end-to-end. Build a source trace: every user story must cite the
   PRD functional requirement ID and the BRD requirement ID it derives from.
3. Materialize each requirement as one self-contained story file under
   `requirements/user-stories/`. Filename kebab-case from the story slug,
   `.md` extension. One story per file — never bundle.
4. ID format `US-NNN` zero-padded, three digits, globally unique inside the
   project. Track the next ID in
   `requirements/user-stories/_index.md` under `## next_id: US-001` etc.
   Increment before writing.
5. Status values: `draft`, `approved`, `rejected`, `superseded`. Priority
   values: `must`, `should`, `could`, `won't` (MoSCoW).
6. Required sections per story file, in order:
   1. `# <Story title>`
   2. Metadata block with at minimum `id`, `status`, `priority`, `feature`,
      `milestone`, `source`.
   3. `## User story` — exactly one paragraph in the form
      `As a <role>, I want <capability>, so that <benefit>.`
   4. `## Context` — links to PRD section, BRD requirement IDs, or evidence
      files.
   5. `## Acceptance criteria` — binary `- [ ]` checklist; every box must be
      objectively verifiable (input → behavior → observable result).
   6. `## Out of scope` — explicit non-goals for this story.
   7. `## Dependencies` — other stories, services, or external systems.
   8. `## Notes` — open questions, assumptions, decisions, risks. Empty
      section is allowed; do not delete it. If the story depends on UI,
      record the needed screen slug here so the wireframe step can render it.
7. One role, one capability, one benefit per story. Split otherwise.
8. Update existing story files in place. Do not duplicate or rename.

## Output

Return artifact paths, user-story IDs and titles, PRD and BRD requirement
IDs covered, source gaps, assumptions, and the exact approval needed.

To view artifacts after writing or changing story files, start the live
dashboard with `mandor dashboard`. The dashboard re-reads artifacts on every
poll (~1s), so JSON and Markdown changes appear automatically within about a
second; no restart or manual refresh is needed. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the user stories, then stop. After approval, the
next required step is wireframes for any story that depends on UI, in a new
session routed to [`-build-wireframe.md`](-build-wireframe.md). Headless
projects skip the wireframe step and proceed directly to planning.
