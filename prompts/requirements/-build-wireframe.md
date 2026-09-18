# Build Wireframes

## Entry criteria

Use only after user stories have been approved. Verify approval status
before proceeding. Source-of-truth is the approved story files; PRD and
brief are back-reference. Skip cleanly if no approved story depends on UI.

Inherits source-trace discipline from the requirements router. Do not
create plans, phases, tasks, or code in this route.

## Process

1. Resolve `<project-path>` and inspect `.mandor/`. Confirm story approval
   and collect every story with a UI dependency recorded under `## Notes`.
2. Build the wireframe list. Assign each screen a stable screen slug
   (kebab-case) and a sequential filename `wf_<n>.html` starting at
   `wf_1.html`. One file per screen. Multiple variants of the same screen
   are allowed (e.g., `wf_3.html` for `login-empty`, `wf_4.html` for
   `login-error`).
3. For each screen, write a single self-contained HTML document under
   `requirements/wireframes/wf_<n>.html`. No external assets except the
   Tailwind CDN script.
4. Tailwind utility classes only. No custom CSS, no `<style>` block.
   Standard `slate` / `sky` / `emerald` / `amber` / `rose` palette only.
5. Stick to low-fidelity placeholders: gray boxes (`bg-slate-200`,
   `bg-slate-300`), lorem-style text, fake data. Never use real PII or
   production copy.
6. Wrap interactive regions in semantic elements (`<form>`, `<nav>`,
   `<main>`, `<section>`, `<article>`). Forms declare `action="#"` and
   `method="post"` so they remain inert. Buttons are
   `<button type="button">` unless the wireframe demonstrates a submit
   flow; submit demos include `onsubmit="return false"`.
7. Every wireframe footer carries a `<dl>` listing `Screen`, `Story`
   (`US-NNN` or `—`), `Status` (`draft` | `approved`), `Updated` (ISO 8601
   UTC).
8. Keep documents offline-safe apart from the Tailwind CDN. No external
   scripts, fonts, or images. Use inline SVG or unicode for icons.

### Required HTML skeleton

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
    <dl class="grid grid-cols-2 gap-1">
      <dt class="font-semibold">Screen</dt><dd><slug></dd>
      <dt class="font-semibold">Story</dt><dd>US-NNN</dd>
      <dt class="font-semibold">Status</dt><dd>draft</dd>
      <dt class="font-semibold">Updated</dt><dd>2026-01-31T08:14:00Z</dd>
    </dl>
  </footer>
</body>
</html>
```

## Discovery and dashboard integration

- Wireframes under `requirements/wireframes/` are auto-collected by the
  dashboard server and rendered in the `Requirements` tab via sandboxed
  iframe (`srcdoc`).
- After writing or editing any wireframe, regenerate the dashboard so the
  new files appear:
  ```sh
  mandor dashboard --port 4173
  # or, for a one-shot snapshot:
  node <skill-dir>/scripts/generate-pm-dashboard.js <project-path>
  ```

## Output

Return wireframe filenames, screen slugs, story IDs served, source gaps,
and the exact approval needed. Mention skipped (headless) stories and why.

After writing or changing wireframes, run the dashboard generator
documented in `SKILL.md`. Managed JSON remains CLI-only.

## Stop condition

Request explicit approval of the wireframes, then stop. State that planning
requires a new session and route the user to
[`build-milestone.md`](../plans/build-milestone.md) after approval.
