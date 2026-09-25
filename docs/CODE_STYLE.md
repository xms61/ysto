---
status: draft
last-verified: 2026-09-25
---

# Code Style

Code should read like the code around it. When this file and the surrounding code disagree, follow this file in the code you write or change.

## Shape
- Small functions that each do one thing. A function that needs a comment to explain its sections should be split into named functions instead.
- Names say what a thing is or does (`recentTrackIds`, `isAbovePopularityFloor`). Avoid `data`, `info`, `helper`, `utils`, `manager`, `handle2`.
- One source of truth per concept (one list of themes, one validator per payload, one place that reads env vars). Import it; don't copy it.
- Keep modules at one level of abstraction: an HTTP route validates, calls a service and responds. It doesn't build SQL.
- Prefer plain data and functions. Add a class only when it owns state or a lifecycle (a database handle, a connection).

## Do not add
- Abstractions for a second use case that doesn't exist yet (plugin systems, generic repositories, factories for one product, config switches nobody sets).
- New dependencies for something the standard library or an existing dependency already does.
- Dead code, commented-out code, "kept for later" branches, unused exports or parameters. Delete them; git remembers.
- Emoji, marketing words ("blazing", "robust", "seamless", "powerful") or exclamation marks in code, logs, commit messages or docs.

## Comments
- Explain *why* (a constraint, a trade-off, a bug being avoided), never *what* the next line does.
- Keep them short. A module header says what the module owns in one or two sentences.
- A temporary workaround names its exit condition: `// ... narrower than the code (removed when X moves to TypeScript)`.

## Errors and boundaries
- Validate every external input (HTTP bodies, query strings, messages, CLI flags, files) at the boundary, in one place, and trust it inside.
- Fail loudly on programmer errors. Degrade gracefully only on expected runtime failures (network, rate limits), and log them once with enough context.
- CLI scripts parse flags strictly: an unknown flag prints the usage and exits non-zero. Anything that deletes data makes a backup first or has a dry-run mode.

## Types (typed languages)
- Type the boundaries (payloads, rows, public functions). Let inference handle locals.
- `unknown` plus a narrowing check beats `any`. A cast needs a comment saying why it is safe.

## Changes
- One concern per PR. A refactor and a behavior change go in separate PRs.
- Update the matching area doc, `README.md` and `CHANGELOG.md` in the same change.
- Code outside your change that breaks these rules is a follow-up: mention it in the PR instead of fixing it there.
