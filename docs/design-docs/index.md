---
status: draft
last-verified: 2026-09-25
---

# Design docs

Technical decisions that later work depends on: what was decided, why, and what was rejected. Player-facing behavior goes in [product specs](../product-specs/index.md) instead.

| Doc | Status | Summary |
| :-- | :-- | :-- |
| [Core beliefs](core-beliefs.md) | draft | How the repo is run for agent-first work |
| [System design](system-design.md) | draft | One Node process, in-memory lobbies, a server-authoritative state machine, the protocol and configuration |
| [Anti-cheat and score integrity](anti-cheat.md) | draft | Why the server owns every decision, and what never reaches a client before the reveal |
| [Catalog](catalog.md) | draft | Source data, SQLite schema, ingest pipeline, franchises and difficulty |
| [Audio clips and playback](audio-clips.md) | draft | Clips cut per round by ffmpeg, served by token, and played through Web Audio |
| [Hosting and deploy](hosting-and-deploy.md) | draft | Docker, the VPS setup, the library export, and pull-based releases from GHCR |

## Adding a design doc
Write one when a decision has real alternatives and future changes depend on it (a storage choice, an API shape, a layering rule). Create `docs/design-docs/<topic>.md` with the frontmatter from [KNOWLEDGE_BASE.md](../KNOWLEDGE_BASE.md#doc-metadata) and these sections: Context, Decision, Alternatives considered, Consequences. Add a row above with the same status as the doc; the doc checks fail when a doc has no row or the statuses differ.
