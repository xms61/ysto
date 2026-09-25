# You Skipped The OP?!

A multiplayer anime music quiz in the browser. Players join a lobby with a code and a name, hear a random sample of an anime opening or ending, and pick the right anime from four options.

## Setup
```bash
git config core.hooksPath .githooks   # blocks commits with media, data, secrets or local paths
<npm ci>
cp .env.example .env
<npm run dev>
```

## Commands
See the Commands table in [AGENTS.md](AGENTS.md).

---

## Using this template (delete this section once done)

Files, and what each one is for:

| File | Purpose |
| :-- | :-- |
| `AGENTS.md` | Entry point for coding agents: a doc map (which doc to read for which task), the commands and the "Always" rules. Agents load it on every task, so it stays under 100 lines (the doc checks enforce it). |
| `ARCHITECTURE.md` | Code map, layers and invariants. |
| `docs/KNOWLEDGE_BASE.md` | How the docs are laid out, the frontmatter every doc carries, what the doc checks enforce, and the recurring doc-gardening pass. |
| `docs/design-docs/`, `docs/product-specs/` | Technical decisions and player-facing specs, each catalogued in an `index.md`. `core-beliefs.md` holds the agent-first operating principles. |
| `docs/PLANS.md`, `docs/exec-plans/` | How to plan; active and completed exec plans and the tech-debt tracker, all committed. |
| `docs/*.md` topic docs | Product sense, design, frontend, reliability, security and quality score. Stubs until the code exists. |
| `docs/generated/`, `docs/references/` | Script-generated reference, and third-party llms.txt files. |
| `scripts/check-docs.mjs` | The doc checks (links, reachability from `AGENTS.md`, frontmatter, indexes, exec plan sections), with tests next to it. |
| `CLAUDE.md` | Imports `AGENTS.md`, so Claude Code reads the same file as other agents. |
| `docs/CODE_STYLE.md` | What good code looks like here, and what not to add. |
| `docs/TESTING.md` | Test commands, isolation rules and how to write tests. |
| `docs/AREA_DOC_TEMPLATE.md` | Copy it next to each area of code (database, API, UI…). Each copy gets a row in the doc map. |
| `.github/RELEASE_PROCESS.md` | Branching, version bump, checklist and PR format. Agents read it before any commit. |
| `.github/pull_request_template.md` | A PR body that states what was and wasn't checked. |
| `.github/workflows/ci.yml` | CI that runs the same commands as `AGENTS.md`. It runs the doc checks now; add the app's jobs with the stack. |
| `CHANGELOG.md`, `docs/CHANGELOG-archive.md` | Keep a Changelog. About 5 releases in the main file, older ones in the archive, so agents read less. |
| `.gitignore` | Keeps secrets, data and `docs/scratch/` (local notes) out of git. |
| `.gitattributes`, `.editorconfig` | LF line endings and consistent whitespace across OSes and agents. |
| `.env.example` | Every env var the app reads. |

Checklist:
1. Replace every `<placeholder>` (search for `<`).
2. Fill in the Commands table in `AGENTS.md` and make CI run the same commands.
3. Write the "Always" rules that are specific to this repo: where real data lives, names that must never change, and how tests are isolated.
4. Add one area doc per area once the code exists, and a row for each in the doc map.
5. Fill in `ARCHITECTURE.md` and the stub docs as the code lands, and move each to `draft` or `verified`.
6. Schedule the doc-gardening pass (`docs/KNOWLEDGE_BASE.md`) once the repo has a remote.
7. Delete this section.
