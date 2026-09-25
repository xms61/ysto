---
status: draft
last-verified: 2026-09-25
---

# Knowledge base

How the docs in this repo are laid out, checked and kept true. The principles behind it are in [core beliefs](design-docs/core-beliefs.md).

## Layout
| Path | Holds | Written by |
| :-- | :-- | :-- |
| [AGENTS.md](../AGENTS.md) | The map: which doc to read for which task, the commands, the always-rules. Under 100 lines. | Hand |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Code map, layers and invariants | Hand |
| `docs/*.md` | One doc per cross-cutting topic: style, testing, frontend, design, reliability, security, quality, plans, product sense | Hand |
| [docs/design-docs/](design-docs/index.md) | Technical decisions, catalogued in the folder's index | Hand |
| [docs/product-specs/](product-specs/index.md) | Player-facing behavior, catalogued in the folder's index | Hand |
| [docs/exec-plans/](PLANS.md) | Active and completed exec plans, and the tech-debt tracker | Hand, as the work happens |
| [docs/generated/](generated/) | Reference produced by scripts, such as the database schema | Scripts only |
| [docs/references/](references/) | llms.txt files and similar docs of third-party libraries | Copied from the source, not edited |
| Area docs | Rules for one area of code, kept next to that code, made from the [template](AREA_DOC_TEMPLATE.md) | Hand |
| `docs/scratch/` | Local notes; git ignores it | Anyone; never committed |

## Doc metadata
Every hand-written doc starts with this frontmatter. Exceptions: AGENTS.md, CLAUDE.md, README.md, the changelogs, `.github/` files and exec plans.

```md
---
status: draft
last-verified: YYYY-MM-DD
---
```

- `stub`: a skeleton with placeholders. Don't rely on it; fill it in once the code it describes exists.
- `draft`: written, but not checked against the code, or the code doesn't exist yet.
- `verified`: checked against the code on `last-verified`. For docs of principles, the owner confirmed it.

Set `last-verified` to the current date whenever you check a doc against the code, including when a change makes you edit it.

## What the doc checks enforce
`node scripts/check-docs.mjs` runs in the pre-commit checklist and in the manually started CI, and fails on:
- a relative link to a file or folder that doesn't exist;
- a doc that can't be reached by following links from AGENTS.md (exec plans, generated and reference files are exempt);
- missing or invalid frontmatter, or a `last-verified` date in the future;
- a doc in `docs/design-docs/` or `docs/product-specs/` without a row in that folder's `index.md`, or a row whose status differs from the doc's;
- an exec plan without its required sections ([PLANS.md](PLANS.md));
- an AGENTS.md longer than 100 lines.

It warns, without failing, about `verified` docs last verified more than 90 days ago. Those are the gardening pass's first work.

## Doc gardening
A pass, run by an agent before each release, that keeps the docs true to the code:
- Run the doc checks and re-verify every doc they warn about.
- Compare what the docs claim (commands, paths, names, rules, the code map in ARCHITECTURE.md) with the code. Fix the doc when the code is right. When the code looks wrong, add a row to the [tech-debt tracker](exec-plans/tech-debt-tracker.md) instead of changing behavior.
- Downgrade a doc to `stub` when it can't be fixed now, so nobody relies on it.
- Move finished exec plans to `completed/`, and delete tech-debt rows that are paid off.
- Open one fix-up PR per area, titled `docs(<area>): <summary>`, following the [release process](../.github/RELEASE_PROCESS.md).

To run it, give an agent this section as its task. It runs before a release rather than on a schedule, because the owner chose that. The release process lists it as a step.
