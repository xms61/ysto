---
status: draft
last-verified: 2026-09-25
---

# Core beliefs

How this repository is run so that agents can do most of the work. When two docs disagree, these decide, and the other doc is fixed in the same change.

1. **The repository is the system of record.** A decision made in chat, a ticket or someone's head is invisible to the next session. Write it into the doc that owns the topic, in the change that makes it.
2. **A map, not a manual.** [AGENTS.md](../../AGENTS.md) stays under 100 lines and points to deeper docs. Context is limited: a long instruction file crowds out the task and the code, and when everything is marked important, nothing is.
3. **One place per fact.** Each fact lives in the doc that owns it. Other docs link to it instead of restating it, so there is one copy to keep true.
4. **Docs describe the system as it is.** Present-tense facts and rules, each with its reason. History belongs in exec plans, the changelog and git.
5. **Plans are artifacts.** Work that outlives one session gets an exec plan with progress and a decision log, committed next to the code, so anyone can resume it from the repo alone.
6. **Check mechanically what can be checked.** Links, structure, index coverage and freshness are enforced by [scripts/check-docs.mjs](../../scripts/check-docs.mjs) in CI; code rules belong in linters and tests. Prose is for judgment calls.
7. **A stale doc is a bug.** A doc that no longer matches the code is fixed, or downgraded to `stub`, when it is found. The recurring [doc-gardening pass](../KNOWLEDGE_BASE.md#doc-gardening) catches what changes miss.
8. **Known debt is written down.** Shortcuts go in the [tech-debt tracker](../exec-plans/tech-debt-tracker.md) when they are taken, so they get paid off on purpose.
