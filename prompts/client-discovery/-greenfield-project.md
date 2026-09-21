# Greenfield Discovery

## Entry criteria

Use for a new product, client intake, presales discovery.
Confirm `<project-path>` and whether the project is greenfield. Do not use
for an existing repository; route that request to `-existing-project.md`.
Inherits the twelve-section `client-brief.md` schema from
`client-discovery.md` and must fill every section.

## Process

1. Resolve `<project-path>`. If the user explicitly requests greenfield project
   creation and it does not exist, create the project directory and the
   `.mandor/` artifact directories. Otherwise create or use only
   `<project-path>/.mandor/`; inspect existing discovery files.
2. Interview the user iteratively. Ask focused questions about the actual problem,
   target users, business goals, rough budget, expected timeline, success measures,
   sensitive information, competitors or references, existing-system integrations,
   technical constraints, and stack preferences. Follow up on consequential gaps;
   do not send one giant questionnaire or assume missing answers.
3. Write `<project-path>/.mandor/client-discovery/client-brief.md` under the
   exact twelve-section schema owned by `client-discovery.md`. Label every
   statement as `[fact|assumption|decision|open]` with a source pointer.
4. Do not create BRD, PRD, plans, user stories, or wireframes in this route.

## Output

Return changed artifact paths, unresolved questions, assumptions, and a concise
discovery summary. Preserve prior evidence and decisions.

To view artifacts after writing or changing discovery Markdown, start the live
dashboard with `mandor dashboard`. The dashboard re-reads artifacts on every
poll (~1s), so JSON and Markdown changes appear automatically within about a
second; no restart or manual refresh is needed. Managed JSON remains CLI-only.

## Stop condition

Stop after discovery. State that requirements require a new session and route the
user to `build-requirement-docs.md`. Never silently begin requirements.
