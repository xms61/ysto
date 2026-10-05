---
status: draft
last-verified: 2026-10-05
---

# Tech debt tracker

Known shortcuts and gaps, written down so they are paid off on purpose instead of rediscovered. Add a row when you take on or find debt; delete the row in the change that pays it off (git keeps the history).

| Debt | Where | Cost of leaving it | Found | Plan |
| :-- | :-- | :-- | :-- | :-- |
| TypeScript is pinned to 6.0.x, because typescript-eslint supports TypeScript below 6.1 | `package.json`, `.github/dependabot.yml` | Typechecks miss the speed of TypeScript 7's native compiler | 2026-09-25 | Move to TypeScript 7 once typescript-eslint supports it, and drop the Dependabot ignore |
| The AnimeThemes sync reads the JSON:API, which AnimeThemes has deprecated and will remove (its docs, read 2026-09-30) | `scripts/catalog/animethemes.ts` | Once it is removed, `catalog:sync-animethemes` fails and the catalog can't be refreshed for a new season | 2026-09-30 | Move the sync to the GraphQL API (same 90 requests a minute) with AnimeThemes' "Migrating from REST API" guide, keep the parsed shape so `assemble.ts` doesn't change, and compare a build against the JSON:API one |
| Some theme details use raw colors outside the theme blocks: Mecha's bevel, seam, rivets and stripe dark; Shonen's muted rim; Isekai's outer ring; Retro VHS's grey stripes; Magical Girl's gem facets; the backdrop decorations | `src/styles.css` | The contrast test reads only the theme blocks, so these colors are never checked, and a theme change can miss them | 2026-09-30 | Move each into its theme block as a named token, and add the ones that carry meaning (the muted rims) to `src/themes.test.ts` |
