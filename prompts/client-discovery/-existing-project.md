# Existing Project Discovery

## Entry criteria

Use when the user names an existing repository, application, service, or
deployed system to inspect. Confirm `<project-path>`. Skip presales and NDA
work unless explicitly requested as a separate, non-lifecycle request. For
new products with no source, route to `-greenfield-project.md`. Inherits the
twelve-section `client-brief.md` schema from `client-discovery.md`.

## Process

1. Inspect source, configuration, documentation, package metadata, migrations,
   deployment definitions, and existing `.mandor/` artifacts. Record only
   observed behavior; trace each finding to a file, section, or command
   output. Separate facts, assumptions, decisions, and open questions.
2. Identify completed milestones from evidence. Do not infer completion from
   filenames alone.
3. Read any existing
   `<project-path>/.mandor/client-discovery/client-brief.md` and update it
   in place under the twelve-section schema from `client-discovery.md`.
   Treat observed behavior as facts and tag them `[fact]` with the source
   pointer. Promote unverified items to `[assumption]` or `[open]`. Never
   overwrite prior decisions without recording the change in `## 11`.
4. Do not create BRD, PRD, user stories, plans, phases, tasks, or wireframes
   in this route. List a needed wireframe in `## 10` instead of fabricating
   HTML.
5. Do not create or regenerate the milestone timeline or phase plans here.

## Output

Return the artifact path, changed sections, gaps, unresolved questions, and
approval questions. Preserve existing completed markers and unrelated project
content.

After writing or changing discovery Markdown, run the dashboard generator
documented in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the updated brief, then stop. State that
requirements require a new session and route the user to
`../requirements/build-requirement-docs.md` after approval.
