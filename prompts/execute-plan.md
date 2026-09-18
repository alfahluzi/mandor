# Sequential Plan Execution

Use only with approved milestone and detailed phase plans. Read timeline and phase
JSON through `<skill-dir>/bin/mandor`; use normal filesystem operations
for Markdown and source. Managed JSON CRUD uses the CLI exclusively.

## Process

1. Summarize scope and ask `continue` or `change`.
2. For changes, use phase `add-change` or update-change commands before execution.
3. Execute phases and tasks in order. Use `set-task-status` and `add-progress`.
4. Preserve source traces and phase `change_request_log` entries.
5. Stop on failure. Never convert a tool or DB failure into success.

Supported JSON fields remain status, progress, source trace, and change log. Do not
invent completion dates, error fields, dependencies, acceptance criteria, or other
fields. Return executed, skipped, failed IDs, evidence locations, and next action.
