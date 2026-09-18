# Build Project Plan

Use `<skill-dir>/bin/mandor` for all timeline JSON reads, lists, and
mutations. Use normal filesystem operations only for Markdown.

## Process

1. Inspect approved requirements and source evidence.
2. Create or update the timeline with `milestone init`, metadata, milestone,
   WBS, risk, source, and approval commands.
3. Milestones use only ID, name, status, start timestamp, and target timestamp.
   Work packages belong in WBS. Risks belong in the risk register.
4. Request explicit approval with `milestone approve` before detailed phase work.

## Output

Return CLI JSON output, changed IDs, evidence locations, and approval questions.
The CLI validates, atomically writes, and regenerates `.mandor/pm.html`.
