---
status: stub
last-verified: 2026-09-25
---

# <Area name>

<!--
Copy this file next to the code it describes (e.g. server/db/DATABASE.md), fill it in,
add a row for it to the doc map in AGENTS.md, set its status (docs/KNOWLEDGE_BASE.md), and delete this comment.
Keep it under ~80 lines: an agent reads it before touching the area, so every line costs.
Write facts and rules, not history. Update it in the same PR as the code.
-->

Entry: `<path/to/entry.ts>`: <what it owns, in one sentence>.
- `<file or folder>`: <responsibility>
- `<file or folder>`: <responsibility>

## Rules
- <An invariant that must hold, e.g. "every write goes through upsertX, never raw INSERT">
- <Where new things go, e.g. "a new payload gets a validator in validators.ts">
- <Limits and thresholds, with the constant that holds them>

## Data / API
| <Table, route or message> | <Key fields> | Notes |
|---|---|---|
| | | |

## Gotchas
- <Something that looks wrong but is intentional, and why>
- <A mistake that is easy to make here, and how to avoid it>

## Tests
`<tests that cover this area>`: <what they prove>.
