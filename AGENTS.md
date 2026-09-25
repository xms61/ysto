# You Skipped The OP?! — Agent Doc Map

A multiplayer anime music quiz in the browser: players join a lobby with a code, hear a random sample of an opening or ending, and pick the anime from four options.

This file is the map, not the manual. The repository is the system of record: what you need to know lives in the docs below, and what is not written in the repo does not exist for the next session. Read only the docs your task needs.

| Doc | Read when |
| :-- | :-- |
| [.github/RELEASE_PROCESS.md](.github/RELEASE_PROCESS.md) | **Before any commit, push, or PR** (branching, version bump, guardrails, checklist) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Finding where code lives, or changing how parts depend on each other |
| [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) | Your first task in this repo, or when two docs seem to disagree |
| [docs/design-docs/index.md](docs/design-docs/index.md) | Making a technical decision, or asking why something is built the way it is |
| [docs/product-specs/index.md](docs/product-specs/index.md) | Building or changing something a player sees |
| [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | Deciding product behavior that no spec covers |
| [docs/PLANS.md](docs/PLANS.md) | Starting work that spans several sessions or areas |
| [docs/exec-plans/active/](docs/exec-plans/active/) | Resuming work, or before starting something that may already be planned |
| [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) | Taking a shortcut, or looking for known gaps |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md) | Writing or reviewing code |
| [docs/TESTING.md](docs/TESTING.md) | Running or writing tests |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Changing UI code |
| [docs/DESIGN.md](docs/DESIGN.md) | Changing how something looks, moves or reads |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Handling errors, timeouts, performance or logging |
| [docs/SECURITY.md](docs/SECURITY.md) | Handling input, secrets, user data or external services |
| [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) | Choosing what to improve, or after a change that moves a grade |
| [docs/references/](docs/references/) | Using a third-party library: its llms.txt here is newer than your memory of it |
| [docs/generated/](docs/generated/) | Looking up generated reference such as the database schema (never edit by hand) |
| [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md) | Adding, moving or checking a doc, or running the doc-gardening pass |

## Commands
| Task | Command |
| :-- | :-- |
| Install | `npm ci` |
| Dev server | `npm run dev` (server on :3000, client on :5173) |
| Production build and server | `npm run build && npm start` (:3000) |
| Lint / format | `npm run lint` / `npm run format` |
| Typecheck | `npm run typecheck` |
| All tests | `npm test` (server), `npm run test:web` (client) |
| One test file | `node --test tests/server/app.test.ts` |
| Browser smoke test | `npm run build && npm run test:e2e` |
| Doc checks | `node scripts/check-docs.mjs` |
| Doc checker tests | `node --test scripts/check-docs.test.mjs` |
| Tracked-files check | `node scripts/check-tracked-files.mjs` (`--staged`: staged files only) |
| Tracked-files checker tests | `node --test scripts/check-tracked-files.test.mjs` |
| Everything CI runs | The doc and tracked-files rows above, gitleaks, `npm run test:ci`, the build and the browser smoke test |

## Always
- Tests never use the network or real data. Use in-memory or temp-dir stores and the test stubs listed in [docs/TESTING.md](docs/TESTING.md).
- The folder in `YSTO_AUDIO_DIR` holds the owner's audio library, and `data/` holds the catalog and caches. Open them read-only for analysis, and never run write or cleanup scripts against them unless asked.
- Committed files never reveal this machine: no home-folder paths, no local user or host names. Refer to locations by env var. Enable the pre-commit hook that checks this once per clone: `git config core.hooksPath .githooks` ([guardrails](.github/RELEASE_PROCESS.md)).
- If the user says a long-running job is running, leave every file that job loads unchanged until they say it has finished.
- Work that spans sessions or areas gets an exec plan in `docs/exec-plans/active/` ([docs/PLANS.md](docs/PLANS.md)), committed with the code and updated as you go. Scratch notes go in `docs/scratch/`, which git ignores; never commit them.
- A decision, constraint or known gap that matters beyond this session goes into the doc that owns it, in the same change. When you change behavior, update the docs that describe it, set their `last-verified`, and run the doc checks. Rules: [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md).
- Script flags go after `--`: `npm run <task> -- --flag=value`.
- Never rename the `YSTO_*` env vars, the `ysto_*` browser storage keys or the Docker volume names once released: that breaks `.env` files, resets players' settings, or starts an empty volume.
- Code style: small functions, clear names instead of comments that say what the code does, no speculative abstractions, no emoji or marketing words in code, logs or docs. Delete dead code instead of keeping it "for later". Details: [docs/CODE_STYLE.md](docs/CODE_STYLE.md).
