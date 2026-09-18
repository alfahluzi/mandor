# Client Discovery — Router

## Purpose

Entry point for every discovery request, covering both new (greenfield) projects
and existing repositories, applications, services, or deployed systems. Dispatch
to the matching sub-prompt and own the shared `client-brief.md` schema that
both routes must produce.

## Entry criteria

Trigger when the user starts a new product, runs a client intake, asks for
presales discovery, scoping, brief, intake, OR names an existing repository /
application / service to inspect. Confirm `<project-path>` and intent before
routing. Skip presales and NDA work unless explicitly requested as a separate,
non-lifecycle request.

## Routing

| User intent | Sub-prompt |
|---|---|
| New product, presales, client intake, no source yet | [`-greenfield-project.md`](-greenfield-project.md) |
| Existing repository, codebase, or deployed service to inspect | [`-existing-project.md`](-existing-project.md) |

When the intent is ambiguous (for example "start the X project" with no source
path), ask one targeted question: "Is there existing source code for X, or is
this greenfield?" Do not guess.

## Shared output — `client-brief.md`

Both routes write or update
`<project-path>/.mandor/client-discovery/client-brief.md` under the exact
twelve-section structure below. The router owns this schema; the sub-prompts
own how each section is filled.

```markdown
# Client / Product Brief — <Project Name>

## 1. Product Identity

## 2. Problem Being Solved

## 3. Target Users

## 4. Business Goals and Success Measures

## 5. Scope — v1 Must-Haves (owner-selected)

| # | Must-have | Class | Source |

## 6. Non-Goals and Deferred Work

## 7. Constraints (verified)

### 7.1 Distribution constraints — the S-1 blocker set
### 7.2 Runtime and stack constraints (accepted)

## 8. References and Competitors

## 9. Integrations and Sensitive Information

## 10. Open Questions (carry into requirements)

## 11. Decision Log

## 12. Status and Next Route
```

### Section rules

- Every claim is tagged `[fact|assumption|decision|open]` with a source
  pointer: `file:line`, evidence URL, stakeholder statement, or interview
  timestamp.
- `## 5` must-have rows use `Class` ∈ {`core`, `supporting`, `nice-to-have`}
  and `Source` ∈ {`brief`, `interview`, `evidence`, `derived`}.
- `## 7.1` is the S-1 distribution blocker set: app-store, regulatory,
  network, geographic, install-base, or compliance gate. An empty section is
  itself a finding — flag it and ask the owner.
- `## 7.2` records runtime and stack constraints the owner has accepted. An
  empty section is also a finding — flag and ask.
- `## 10` is the only section allowed to carry items forward unresolved.
- `## 11` logs every decision with timestamp, decider, reason, and rejected
  alternatives.
- `## 12` shows the current lifecycle state and the next route.

### File location and lifecycle

- Path: `<project-path>/.mandor/client-discovery/client-brief.md`.
- Greenfield projects create `.mandor/` and the brief file. Existing projects
  inspect `.mandor/client-discovery/` and update in place — never duplicate or
  rename.

## Routing rules for sub-prompts

- Both sub-prompts must terminate by writing or updating the brief above.
- Neither sub-prompt writes `BRD.md`, `PRD.md`, user stories, plans, phases,
  tasks, or wireframes.
- Both stop at the discovery gate and hand off to
  [`build-requirement-docs.md`](../requirements/build-requirement-docs.md).
- Approval is always explicit. Never auto-advance the lifecycle.

## Output

Return the artifact path, changed sections, unresolved questions, assumptions,
and a concise discovery summary. Preserve prior evidence, decisions, and
completed markers.

After writing or changing the brief, run the dashboard generator documented in
`SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit user approval of the brief. Stop even if the user appears to
want requirements next. Requirements is a new session routed to
[`build-requirement-docs.md`](../requirements/build-requirement-docs.md).
