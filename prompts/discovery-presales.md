# Greenfield Discovery and Presales

## Entry criteria

Use for a new product, client intake, presales discovery, or a requested NDA
draft. Confirm `<project-path>` and whether the project is greenfield. Do not use
for an existing repository; route that request to `discover-existing-project.md`.

## Process

1. Resolve `<project-path>`. If the user explicitly requests greenfield project
   creation and it does not exist, create the project directory and the
   `.project-manager/` artifact directories. Otherwise create or use only
   `<project-path>/.project-manager/`; inspect existing discovery files.
2. Interview the user iteratively. Ask focused questions about the actual problem,
   target users, business goals, rough budget, expected timeline, success measures,
   sensitive information, competitors or references, existing-system integrations,
   technical constraints, and stack preferences. Follow up on consequential gaps;
   do not send one giant questionnaire or assume missing answers.
3. Write `client-discovery/client-brief.md`. Label every statement as verified
   fact, assumption, decision, or open question, and record its source.
4. Create `client-discovery/nda.md` only when requested or justified. Mark it
   `DRAFT - REQUIRES LEGAL REVIEW`; avoid legal conclusions or validity claims.
5. Do not create BRD, PRD, plans, user stories, or wireframes in this route.

## Output

Return changed artifact paths, unresolved questions, assumptions, and a concise
discovery summary. Preserve prior evidence and decisions.

After writing or changing discovery Markdown, run the dashboard generator documented
in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Stop after discovery. State that requirements require a new session and route the
user to `build-requirement-docs.md`. Never silently begin requirements.
