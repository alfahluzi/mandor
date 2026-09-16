# Requirements Authoring

## Entry criteria

Use for BRD, PRD, user stories, wireframes, or requirements work after discovery,
or for a user explicitly requesting requirements in an existing project. Verify
the discovery or existing-project evidence source. Do not assume approval.

## Process

1. Resolve and inspect `<project-path>/.project-manager/` plus cited source
   material. Build a source trace before making claims.
2. Decide which artifacts are needed: `BRD.md`, `PRD.md`, user-story files, and
   HTML wireframes only when requested and justified.
3. Write requirements with sections for verified facts, assumptions, decisions,
   open questions, scope, non-goals, acceptance criteria, dependencies, risks,
   and source traceability. Use only supported content.
4. Break approved needs into features or modules, identify MVP versus later scope,
   and produce user stories or use cases with testable acceptance criteria.
5. Keep stable identifiers for requirements and stories. Update existing material
   rather than duplicating it. Do not create empty optional artifacts.
6. Validate names, dates, links, and status values against
   `../references/artifact-contracts.md`.

## Output

Return artifact paths, requirement IDs changed, source gaps, assumptions, and the
exact approval needed. Mention omitted artifacts and why.

After writing or changing Markdown or wireframes, run the dashboard generator
documented in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the requirements. Stop even if the user appears to
want a roadmap next. After approval, planning is a new session routed to
`build-project-plan.md`.
