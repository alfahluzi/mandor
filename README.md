# project-manager

Portable skill package for project discovery, requirements, milestone planning,
phase planning, sequential execution, and evidence-preserving artifact work.
It is platform-neutral: use the Markdown instructions with any compatible agent
host. Lifecycle gates and approval semantics remain explicit.

## Manual installation

Copy the complete `project-manager/` directory to one project-level path:

```text
project: .opencode/skills/project-manager/
project: .claude/skills/project-manager/
project: .agents/skills/project-manager/
```

Or one global path:

```text
global: ~/.config/opencode/skills/project-manager/
global: ~/.claude/skills/project-manager/
global: ~/.agents/skills/project-manager/
```

Restart or reload the agent host if required by that platform.

Optional installer:

```sh
REPO_URL=https://github.com/alfahluzi/project-manager.git sh install.sh --destination ~/.agents/skills
```

One-line installation:

```sh
curl -fsSL https://raw.githubusercontent.com/alfahluzi/project-manager/main/install.sh | sh
```

The `REPO_URL`, `REF`, and `SKILL_SUBDIR` environment variables remain available
for overrides. Set
`SKILL_SUBDIR` when the package is stored below a multi-skill repository root;
the default assumes this package is the repository root.

The installer refuses ambiguous destinations and existing installations unless
`--force` is supplied. It requires `curl`, `tar`, and a configured public GitHub
`REPO_URL`.

## Use

Load `SKILL.md`, provide a project path, and request one lifecycle stage. Runtime
artifacts live only under `<project-path>/.project-manager/`. Resolve
`<skill-dir>/bin/project-manager` relative to the package. Optional PATH setup:

```sh
ln -s "$(pwd)/bin/project-manager" "$HOME/.local/bin/project-manager"
project-manager --project PATH milestone init --name example-project --version 1.0.0
project-manager --project PATH milestone list --json
project-manager --project PATH plan init example-project
project-manager --project PATH plan list
```

By default, commands print a human-readable representation. Use `--json` for
machine-readable JSON and interoperability. Every successful JSON mutation
validates the full document, writes atomically, and regenerates `pm.html`; reads
do not mutate.
Phase deletion rejects non-empty phases unless `--force`; forced deletion is
irreversible. Milestone initialization refuses overwrite unless `--force`.
Plan initialization is idempotent and preserves existing phase files.

Manual dashboard generation:

```sh
 node <skill-dir>/scripts/generate-pm-dashboard.js <project-path>
```

The generator also accepts `--project <project-path>`. It recursively reads the
supported artifact tree, excludes `pm.html`, tolerates malformed JSON with
warnings, and writes `<project-path>/.project-manager/pm.html` deterministically.

Open `pm.html` directly in a browser; no server is required. Styling loads
Tailwind from its CDN, so styling needs network access. Artifact data remains
embedded in the local HTML snapshot. Wireframes render in sandboxed iframes
without `allow-scripts`.

Dashboard tabs: Client Discovery; Requirements with document text and every
recursive HTML wireframe preview; Plans with timeline summary, plan accordions,
phase columns, and task rows. Other supported JSON is shown in a fallback section.

## GitHub-ready structure

```text
project-manager/
  SKILL.md  README.md  LICENSE  install.sh
  prompts/*.md
  references/artifact-contracts.md
  bin/project-manager
  scripts/project-manager.js
  scripts/generate-pm-dashboard.js
  templates/pm.html
  templates/json/*.json
```

Publish checklist: review links and platform compatibility; verify current
directory submission rules before using
agentskills.io, mdskills.ai, or agentskill.sh. Submit the package directory
according to each directory's current instructions. No submission or command
compatibility is claimed here.

## Guarantees

- Greenfield discovery stops before requirements.
- Requirements request approval before planning.
- Milestone approval precedes detailed phase plans.
- Execution is sequential, resumable, evidence-preserving, and failure-aware.
- Existing-project timelines preserve evidenced completed milestones.
- NDA text is never presented as legal advice or a valid agreement.
