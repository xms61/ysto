# <Project name> — Agent Doc Map

<One sentence: what this project is and who uses it.>

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
| <path/to/AREA.md> | <Touching that area: one row per area doc, next to the code it describes> |

## Commands
| Task | Command |
| :-- | :-- |
| Install | `<npm ci>` |
| Dev server | `<npm run dev>` |
| Lint / format | `<npm run lint>` / `<npm run format>` |
| Typecheck | `<npm run typecheck>` |
| All tests | `<npm test>` |
| One test file | `<node --test path/to/file.test.ts>` |
| Doc checks | `node scripts/check-docs.mjs` |
| Doc checker tests | `node --test scripts/check-docs.test.mjs` |
| Everything CI runs | The two doc rows above, plus `<npm run test:ci>` |

## Always
- Tests never use the network or real data. Use in-memory or temp-dir stores and the test stubs listed in [docs/TESTING.md](docs/TESTING.md).
- `<data/ or other path>` holds the user's real data. Open it read-only for analysis, and never run write or cleanup scripts against it unless asked.
- If the user says a long-running job is running, leave every file that job loads unchanged until they say it has finished.
- Work that spans sessions or areas gets an exec plan in `docs/exec-plans/active/` ([docs/PLANS.md](docs/PLANS.md)), committed with the code and updated as you go. Scratch notes go in `docs/scratch/`, which git ignores; never commit them.
- A decision, constraint or known gap that matters beyond this session goes into the doc that owns it, in the same change. When you change behavior, update the docs that describe it, set their `last-verified`, and run the doc checks. Rules: [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md).
- Script flags go after `--`: `<npm run task -- --flag=value>`.
- <Names that must never be renamed, and why (storage keys, env vars, volume names, public API paths).>
- Code style: small functions, clear names instead of comments that say what the code does, no speculative abstractions, no emoji or marketing words in code, logs or docs. Delete dead code instead of keeping it "for later". Details: [docs/CODE_STYLE.md](docs/CODE_STYLE.md).
