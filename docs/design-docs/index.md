---
status: draft
last-verified: 2026-09-25
---

# Design docs

Technical decisions that later work depends on: what was decided, why, and what was rejected. Player-facing behavior goes in [product specs](../product-specs/index.md) instead.

| Doc | Status | Summary |
| :-- | :-- | :-- |
| [Core beliefs](core-beliefs.md) | draft | How the repo is run for agent-first work |

## Adding a design doc
Write one when a decision has real alternatives and future changes depend on it (a storage choice, an API shape, a layering rule). Create `docs/design-docs/<topic>.md` with the frontmatter from [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md#doc-metadata) and these sections: Context, Decision, Alternatives considered, Consequences. Add a row above with the same status as the doc; the doc checks fail when a doc has no row or the statuses differ.
