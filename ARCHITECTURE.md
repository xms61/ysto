---
status: stub
last-verified: 2026-09-25
---

# Architecture

The shape of the system: what each part owns and which way dependencies point. Keep it to what changes rarely; details belong in the area docs next to the code.

## Bird's-eye view
<What the app does end to end, in one paragraph: who plays, where quiz content comes from, what runs on the server and what in the browser.>

## Code map
<One entry per top-level folder or package: what it owns, and what it must not import.>
- `<folder>/`: <responsibility>

## Layers
<The allowed dependency direction, e.g. "routes call services, services call the store, nothing imports routes", and the check that enforces it.>

## Invariants
- <A rule that holds everywhere, and the test or lint rule that enforces it>

## Cross-cutting concerns
Each has an owner doc; link to it instead of restating it: errors and logging in [RELIABILITY.md](docs/RELIABILITY.md), secrets and input validation in [SECURITY.md](docs/SECURITY.md), test seams in [TESTING.md](docs/TESTING.md), generated schemas in [docs/generated/](docs/generated/).

## Area docs
Each area of code has a doc next to it, made from the [area doc template](docs/AREA_DOC_TEMPLATE.md) and listed in the map in [AGENTS.md](AGENTS.md).
