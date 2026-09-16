# Artifact Contracts

Managed JSON CRUD uses `<skill-dir>/bin/project-manager` exclusively. CLI reads
validate complete documents before output. Markdown remains ordinary filesystem
content. Plan names are lowercase kebab-case. All timestamps are ISO 8601 with
timezone; generated timestamps use UTC second precision.

## Timeline

`plans/milestone-timeline.json` exact top-level fields:
`schema_version`, `name`, `version`, `created_at`, `updated_at`, `next_ids`,
`approval`, `source_trace`, `milestones`, `wbs`, `risk_register`,
`change_request_log`.

`next_ids` is `{source,milestone,wbs,risk,change}`. Source entries are
`{id,location,claim}`. Approval is `{status,timestamp,evidence}` with status
`requested`, `approved`, or `rejected`. Milestones are
`{id,name,status,start_timestamp,target_timestamp}`. WBS entries are
`{id,milestone_id,name}`. Risks are `{id,description,likelihood,impact,mitigation,owner,status}`.
Timeline changes are `{id,timestamp,summary,reason,affected_ids,decision,evidence}`.

## Phase

`plans/<plan>/phase_N.json` exact fields:
`schema_version`, `plan_name`, `phase_number`, `milestone_id`, `title`, `status`,
`created_at`, `updated_at`, `next_ids`, `source_trace`, `tasks`,
`change_request_log`. `phase_number` is the ID and matches `phase_N.json`.
`next_ids` is `{source,task,change}`. Phase source entries add `milestone_id`:
`{id,milestone_id,location,claim}`. Tasks are
`{id,title,detail,status,progress}`. Progress entries are `{timestamp,message}`.
Phase changes use the timeline change shape. No phase approvals or completion
markers exist. Status values are `todo`, `in_progress`, `completed`, `failed`.

## CLI semantics

`plan init` creates a missing plan directory. Existing directories report already
initialized and do not mutate. Phase deletion rejects non-empty phases unless
`--force`; forced deletion is irreversible. Every successful mutation atomically
commits JSON then regenerates `pm.html`.
