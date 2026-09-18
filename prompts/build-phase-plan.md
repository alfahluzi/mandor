# Build Phase Plan

Use `<skill-dir>/bin/mandor` for all timeline and phase JSON reads,
lists, and mutations. Use normal filesystem operations only for Markdown.

## Process

1. Confirm approved milestone timeline.
2. Initialize the plan directory with `plan init`.
3. Add phases using phase number, milestone ID, title, and status.
4. Add tasks with title, detail, status, and progress entries.
5. Add phase source traces and change requests through CLI commands.

Phase number is the ID and filename number. No phase ID, approvals, dependencies,
acceptance criteria, or completion markers exist. The CLI validates, atomically
writes, and regenerates `.mandor/pm.html`.
