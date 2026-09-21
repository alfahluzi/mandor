# Requirements Authoring — Router

## Purpose

Entry point for all requirements work after discovery approval. Dispatch
through four sequential sub-prompts in fixed order. Each sub-prompt writes
exactly one artifact type, gates on approval, then hands off to the next.

## Entry criteria

Use only after the client brief has been explicitly approved. Verify the
source brief exists at
`<project-path>/.mandor/client-discovery/client-brief.md` and is approved.
Do not assume approval.

## Sequential pipeline

| # | Sub-prompt | Output artifact | Gate after |
|---|---|---|---|
| 1 | [`-build-brd.md`](-build-brd.md) | `requirements/BRD.md` | approval of BRD |
| 2 | [`-build-prd.md`](-build-prd.md) | `requirements/PRD.md` | approval of PRD |
| 3 | [`-build-user-stories.md`](-build-user-stories.md) | `requirements/user-stories/US-NNN-<slug>.md` | approval of stories |
| 4 | [`-build-wireframe.md`](-build-wireframe.md) | `requirements/wireframes/wf_<n>.html` | approval of wireframes |

Run them in order. Do not skip ahead, do not run in parallel, do not combine
two steps in one pass. Each sub-prompt names the previous artifact paths it
reads from; the router only verifies the brief exists and is approved.

## Source-trace discipline

Every claim in every artifact must carry a source pointer — file:line,
evidence URL, stakeholder statement, or interview timestamp. Tag every
statement `[fact|assumption|decision|open]`. Drop nothing from the brief
silently: promote unverified items to `[assumption]` with a source or `[open]`
in Open Questions.

## Routing rules for sub-prompts

- Every sub-prompt writes or updates exactly one artifact type.
- Every sub-prompt ends at an approval gate.
- Every sub-prompt names its next route inside its own stop condition.
- No sub-prompt creates plans, phases, tasks, code, or non-requirements
  artifacts.

## Approval lifecycle

- BRD approval required before PRD.
- PRD approval required before user stories.
- Story approval required before wireframes for stories that need them.
- Final wireframe approval ends the requirements route. Planning is a new
  session routed to [`build-milestone.md`](../plans/build-milestone.md).

## Output

Return the artifact path of the router itself, each sub-prompt invoked, the
changed sections, and the final approval needed for planning.

To view artifacts after writing or changing any requirements Markdown or
wireframes, start the live dashboard with `mandor dashboard`. The dashboard
re-reads artifacts on every poll (~1s), so JSON, Markdown, and wireframe
changes appear automatically within about a second; no restart or manual
refresh is needed. Managed JSON remains CLI-only.

## Stop condition

After all four sub-prompts have written and been approved, state that
planning requires a new session and route the user to
[`build-milestone.md`](../plans/build-milestone.md).
