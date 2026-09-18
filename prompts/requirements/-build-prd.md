# Build PRD

## Entry criteria

Use only after `BRD.md` has been approved. Verify approval status before
proceeding. Source-of-truth is the approved `BRD.md`; the client brief is
back-reference context.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm BRD approval and
   list BRD requirement IDs.
2. Read BRD end-to-end and the client brief for context. Build a source
   trace: every PRD statement must point back to a BRD requirement ID and the
   brief section it derives from.
3. Draft `PRD.md` with sections: `Product overview`, `Goals and non-goals`,
   `Personas`, `User journeys`, `Functional requirements` (mapped to BRD
   requirement IDs), `Non-functional requirements`, `Constraints`,
   `Assumptions`, `Acceptance approach`, `Risks`, `Open questions`,
   `Source trace`, `Approval status`. Merge sections only when the BRD
   justifies it.
4. Identify MVP scope versus deferred scope. Tag every functional
   requirement with MoSCoW priority (`must`, `should`, `could`, `won't`).
5. Tag every statement `[fact|assumption|decision|open]` with a source
   pointer. Never silently drop a BRD requirement.
6. Update existing `PRD.md` in place when one already exists. Do not
   duplicate or rename.

## Output

Return artifact path, changed sections, requirement IDs created, MoSCoW
breakdown, source gaps, assumptions, and the exact approval needed.

After writing or changing `PRD.md`, run the dashboard generator documented in
`SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the PRD, then stop. After approval, the next
required step is user-story generation in a new session routed to
[`-build-user-stories.md`](-build-user-stories.md).
