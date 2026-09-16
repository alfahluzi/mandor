# Existing Project Discovery

## Entry criteria

Use when the user names an existing repository, application, service, or project
to inspect. Confirm `<project-path>`. Skip presales and NDA work unless directly
requested as a separate, non-lifecycle request.

## Process

1. Inspect source, configuration, documentation, package metadata, migrations,
   deployment definitions, and existing `.project-manager/` artifacts.
2. Record only observed behavior and trace each finding to a file, section, or
   command output. Separate facts, assumptions, decisions, and open questions.
3. Identify completed milestones from evidence. Do not infer completion from
   filenames alone.
4. Draft or update `requirements/BRD.md`, `requirements/PRD.md`, and
   `requirements/user-stories/*.md` only when needed. List a needed wireframe
   instead of fabricating HTML.
5. Do not create or regenerate the milestone timeline or phase plans here.

## Output

Return evidence summary, requirement artifact paths, gaps, and approval questions.
Preserve existing completed markers and unrelated project content.

After writing or changing Markdown artifacts, run the dashboard generator documented
in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit requirements approval, then stop. State that planning requires a
new session and route the user to `build-project-plan.md` after approval.
