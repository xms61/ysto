---
status: draft
last-verified: 2026-10-06
---

# Tech debt tracker

Known shortcuts and gaps, written down so they are paid off on purpose instead of rediscovered. Add a row when you take on or find debt; delete the row in the change that pays it off (git keeps the history).

| Debt | Where | Cost of leaving it | Found | Plan |
| :-- | :-- | :-- | :-- | :-- |
| TypeScript is pinned to 6.0.x, because typescript-eslint supports TypeScript below 6.1 | `package.json`, `.github/dependabot.yml` | Typechecks miss the speed of TypeScript 7's native compiler | 2026-09-25 | Move to TypeScript 7 once typescript-eslint supports it, and drop the Dependabot ignore |
| The clip bench has not run on the VPS, and its ports have not been scanned from outside | The VPS ([DEPLOY.md](../DEPLOY.md#open-checks)) | Clip timing on the VPS's CPU and the firewall are assumed, not measured | 2026-10-05 | The owner runs both checks after the next update and records the results in RELIABILITY.md and SECURITY.md |
| No e2e test of a typed answer on a phone keyboard | `e2e/` | A layout or focus problem with the on-screen keyboard could ship unseen | 2026-10-06 | Add a Playwright test on a phone viewport that types, picks a suggestion and checks the field stays in view |
| The `docker` CI job isn't a required check of the `main` ruleset | Repo settings | A PR that breaks the image could merge | 2026-10-05 | The owner adds it next to `guard`, `docs`, `app` and `e2e` |
| No playtest with friends yet, so scoring, difficulty cuts and timings are tuned only by the spec | `shared/scoring.ts`, `server/game/` | Real games may feel off in ways tests can't show | 2026-10-05 | Play with friends on the VPS, then tune; the eight newest theme worlds want the owner's review in the same sessions |
