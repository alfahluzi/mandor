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

## User-story generation

When the approved PRD lists features or use cases, materialize each as a
self-contained user story. Skip if the user has not approved scope or explicitly
opts out.

### File layout

- Directory: `<project>/.project-manager/requirements/user-stories/`
- Filename: kebab-case from the story slug, `.md` extension.
  Example: `password-reset-by-email.md`.
- Each file is one story. Do not bundle multiple stories in one Markdown file.
- The leading heading uses the story title. The first metadata block lists ID,
  status, priority, feature, milestone, and source pointers.

### Story ID scheme

- ID format: `US-NNN` where `NNN` is zero-padded, three digits, globally unique
  inside the project. Track the next ID in
  `<project>/.project-manager/requirements/user-stories/_index.md` as a plain
  text list under `## next_id: US-001` etc. Increment before writing.
- Status values: `draft`, `approved`, `rejected`, `superseded`.
- Priority values: `must`, `should`, `could`, `won't` (MoSCoW).

### Required sections per story

Each story file must contain, in order:

1. `# <Story title>`
2. Metadata table or front-matter-style block with at minimum:
   `id`, `status`, `priority`, `feature`, `milestone`, `source`.
3. `## User story` — exactly one paragraph in the form
   `As a <role>, I want <capability>, so that <benefit>.`
4. `## Context` — links to PRD section, BRD requirement IDs, or evidence files.
5. `## Acceptance criteria` — a checklist `- [ ] ...`. Every box must be
   objectively verifiable (input → behavior → observable result).
6. `## Out of scope` — explicit non-goals for this story.
7. `## Dependencies` — other stories, services, or external systems.
8. `## Notes` — open questions, assumptions, decisions, risks. Empty section is
   allowed; do not delete it.

### Quality rules

- One role, one capability, one benefit per story. Split otherwise.
- Acceptance criteria are binary (pass/fail), not vague adjectives.
- Never invent metrics, user counts, or performance targets without source.
- If a story depends on UI, the wireframe for that story must already exist or
  be generated in the same pass (see wireframe prompt below).

## Static HTML wireframe generation

When a feature has user-facing screens, produce a low-fidelity HTML wireframe
per screen. Skip if the user explicitly opts out or the feature is headless.

### File layout

- Directory: `<project>/.project-manager/requirements/wireframes/`
- Filename: kebab-case from the screen slug, `.html` extension.
  Example: `password-reset-form.html`, `dashboard-shell.html`.
- One file per screen. Multiple variants of the same screen are allowed
  (e.g., `login-empty.html`, `login-error.html`).

### Required structure

Every wireframe file must be a single self-contained HTML document. No
external assets except the Tailwind CDN script:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><Screen name> — Wireframe</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-900 min-h-screen">
  <header class="bg-white border-b border-slate-200">
    <!-- top nav, breadcrumbs, page title -->
  </header>
  <main class="mx-auto max-w-5xl p-6">
    <!-- screen-specific layout: forms, lists, cards, tables -->
  </main>
  <footer class="mx-auto max-w-5xl p-6 text-xs text-slate-500">
    <!-- wireframe metadata -->
  </footer>
</body>
</html>
```

### Layout and styling rules

- Use Tailwind utility classes only. No custom CSS, no `<style>` block.
- Use the standard slate / sky / emerald / amber / rose palette. Avoid custom
  colors and custom fonts. Tailwind CDN already supplies defaults.
- Stick to low-fidelity placeholders: gray boxes (`bg-slate-200`,
  `bg-slate-300`), lorem-style text, fake data. Never use real PII or production
  copy.
- Wrap interactive regions in semantic elements (`<form>`, `<nav>`, `<main>`,
  `<section>`, `<article>`) so accessibility tooling still works.
- Forms must declare `action="#"` and `method="post"` so they remain inert.
- Buttons must be `<button type="button">` unless the wireframe is specifically
  demonstrating a submit flow; in that case include a stub `onsubmit="return false"`.
- Keep the document offline-safe apart from the Tailwind CDN. No other external
  scripts, fonts, or images. Use inline SVG or unicode for icons.

### Footer metadata block

Every wireframe footer must include a small `<dl>` listing:

- `Screen:` the screen slug
- `Story:` the `US-NNN` story ID this wireframe serves (or `—` if exploratory)
- `Status:` `draft` | `approved`
- `Updated:` ISO 8601 timestamp in UTC

Example:

```html
<footer class="mx-auto max-w-5xl p-6 text-xs text-slate-500">
  <dl class="grid grid-cols-2 gap-1">
    <dt class="font-semibold">Screen</dt><dd>password-reset-form</dd>
    <dt class="font-semibold">Story</dt><dd>US-014</dd>
    <dt class="font-semibold">Status</dt><dd>draft</dd>
    <dt class="font-semibold">Updated</dt><dd>2026-01-31T08:14:00Z</dd>
  </dl>
</footer>
```

### Discovery and dashboard integration

- Wireframes under `requirements/wireframes/` are auto-collected by the
  dashboard server and rendered in the `Requirements` tab via sandboxed iframe
  (`srcdoc`).
- After writing or editing any wireframe or user-story file, regenerate the
  dashboard so the new files appear:
  ```sh
  project-manager dashboard --port 4173
  # or, for a one-shot snapshot:
  node <skill-dir>/scripts/generate-pm-dashboard.js <project-path>
  ```

## Output

Return artifact paths, requirement IDs changed, user-story IDs and titles,
wireframe screen names, source gaps, assumptions, and the exact approval needed.
Mention omitted artifacts and why.

After writing or changing Markdown or wireframes, run the dashboard generator
documented in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the requirements. Stop even if the user appears to
want a roadmap next. After approval, planning is a new session routed to
`build-project-plan.md`.
