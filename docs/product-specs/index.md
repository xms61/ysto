---
status: draft
last-verified: 2026-09-25
---

# Product specs

What a player can do, one spec per feature, with the acceptance criteria that show it works. How it is built goes in [design docs](../design-docs/index.md); what to favor where no spec says goes in [PRODUCT_SENSE.md](../PRODUCT_SENSE.md).

| Spec | Status | Summary |
| :-- | :-- | :-- |

## Adding a spec
Create `docs/product-specs/<feature>.md` with the frontmatter from [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md#doc-metadata) and these sections: Goal, Behavior, Acceptance criteria, Out of scope. Add a row above with the same status as the spec; the doc checks fail when a spec has no row or the statuses differ.
