---
status: draft
last-verified: 2026-09-25
---

# Tech debt tracker

Known shortcuts and gaps, written down so they are paid off on purpose instead of rediscovered. Add a row when you take on or find debt; delete the row in the change that pays it off (git keeps the history).

| Debt | Where | Cost of leaving it | Found | Plan |
| :-- | :-- | :-- | :-- | :-- |
| TypeScript is pinned to 6.0.x, because typescript-eslint supports TypeScript below 6.1 | `package.json`, `.github/dependabot.yml` | Typechecks miss the speed of TypeScript 7's native compiler | 2026-09-25 | Move to TypeScript 7 once typescript-eslint supports it, and drop the Dependabot ignore |
| The catalog was built from the 2026-09-19 AnimeThemes dump, because the API was down | `data/cache/animethemes/` (local) | No AnimeThemes series, synonyms or cover links, so reveals have no covers yet. Franchises rest on AniList relations alone, and 4 small groups stay split (Black Rock Shooter, Votoms recaps, a Precure crossover film) | 2026-09-25 | Once the API answers, run `catalog:sync-animethemes -- --refresh`, check that the `images` field matches its documented shape (`facet`, `link`), then run `catalog:build`, `catalog:covers` and `catalog:check`, and compare the franchise report |
