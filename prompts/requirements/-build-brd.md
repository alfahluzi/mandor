# Build BRD

## Entry criteria

Use after the client brief at
`<project-path>/.mandor/client-discovery/client-brief.md` has been approved.
Verify the brief is approved before proceeding. Inherits source-trace
discipline from the requirements router. Do not create PRD, user stories, or
wireframes in this route.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm the brief is
   approved and list every section it contains.
2. Read the brief end-to-end. Build a source trace: every claim restated in
   the BRD must point back to a brief section plus its original source
   pointer.
3. Draft `BRD.md` with sections: `Product overview`, `Business objectives`,
   `Stakeholders`, `Scope (in / out)`, `Constraints`, `Assumptions`,
   `Dependencies`, `Success criteria`, `Risks`, `Open questions`,
   `Source trace`, `Approval status`. Merge or add sections only when the
   brief justifies them.
4. Tag every statement `[fact|assumption|decision|open]` with a source
   pointer. Promote unverified brief items to `[assumption]` with a source
   or `[open]` in the Open Questions section. Never silently drop a brief
   item.
5. Use only supported content. Update existing `BRD.md` in place when one
   already exists. Do not duplicate or rename.

## Output

Return artifact path, changed sections, BRD requirement IDs created, source
gaps, assumptions, and the exact approval needed.

After writing or changing `BRD.md`, run the dashboard generator documented in
`SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the BRD, then stop. After approval, the next
required step is PRD in a new session routed to
[`-build-prd.md`](-build-prd.md).
