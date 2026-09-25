---
status: draft
last-verified: 2026-09-25
---

# Catalog

## Context
The audio library is a set of `.ogg` files in the AnimeThemes layout: `<year>/<Season>/<Basename>.ogg` from 2000 on, and `<decade>/` for the 60s–90s. The files are Opus, 48 kHz stereo, about 315 kbps. `YSTO_AUDIO_DIR` points at the library, which stays outside the repo and is never committed. A survey on 2026-09-25 found:
- **Matching:** almost every file matches a theme by its basename. The rest are duplicates (`.1` copies) and theatrical variants. Some themes have more than one file, such as a `-NCBD1080` variant.
- **Durations:** mostly TV size, around 90 s. A few percent are under 45 s, and a few run past 2 minutes.
- **Tags and loudness:** the files carry only an encoder tag, and a random sample measured about −16 LUFS integrated, so the audio already looks normalized.
- **AnimeThemes metadata:** 4,940 anime and 14,447 themes (5,585 OP, 8,862 ED). Each anime has one display name (mostly romaji) and external IDs, but no English or Japanese titles, genres, popularity or cover art. 4,934 anime have an AniList ID, and AniList supplies the missing fields.
- **Concentration:** Detective Conan has 79 themes, One Piece 73, Naruto Shippuuden 60 and Bleach 45. The 145 anime with 10 or more themes hold 2,320 themes (16%).
- **Shared songs:** 94 songs are credited to more than one anime, for example Date A Live and its OVA.
- **Formats and years:** TV 3,545, Movie 430, OVA 355, TV Short 331, ONA 198, Special 81. Years run from 1963 to 2026.

## Decision
**Stores.**

| Store | Contents | Written by | At runtime | In git |
| :-- | :-- | :-- | :-- | :-- |
| `catalog.sqlite` | anime, franchises, genres, songs, artists, themes, audio files, difficulty | `npm run catalog:build` | mounted read-only, loaded into memory at startup | never |
| `covers/` | one cover image per anime, named after its AniList id | `npm run catalog:covers` | read-only, served at `/covers` | never |
| Audio library | the source `.ogg` files; on the VPS, the exported copy | the owner; `catalog:export` (M8) | read-only | never |
| `data/cache/` | raw AnimeThemes pages, AniList media, ffprobe durations | the ingest steps | not mounted | never |

**Schema.** `server/catalog/schema.ts` is the one definition, and the build regenerates [catalog-schema.md](../generated/catalog-schema.md) from it. Its main choices:
- **Adult anime are left out entirely** (AniList `isAdult`, or the Hentai genre), so no game can pick one, not even as a wrong option. `catalog:check` cross-checks this against the AniList cache.
- **A theme is playable exactly when it has a difficulty**, which the build sets only when the theme's primary file lasts at least 18 s. That's the shortest sample (10 s) plus the 3 s lead-in and 5 s tail that sample offsets keep clear.
- Each theme's **primary file** is the one it plays from: the lowest entry version, then the first path. Other files stay listed.
- A **franchise id** is the smallest anime id in the franchise, so ids are stable across builds of the same data.

**Ingest steps.** Each step is its own command, caches what it fetched or measured under `YSTO_CACHE_DIR`, and resumes after an interruption. The commands and cache layout are in [scripts/catalog/CATALOG.md](../../scripts/catalog/CATALOG.md).
1. **`catalog:sync-animethemes`** pages through `api.animethemes.moe/anime`, including songs, artists, entries, videos, resources, series and synonyms. That's about 50 pages of 100 anime, one request a second. `--from-dump <file>` imports an existing dump instead, which lacks `series` and synonyms. A `complete.json` marker is written last, so a build never starts from half a sync.
2. **`catalog:scan-audio`** reads every file's duration with ffprobe, several at a time. Results are cached by path, size and mtime, so a rescan only probes what changed.
3. **`catalog:enrich-anilist`** fetches titles (romaji, English, native), synonyms, genres, popularity, `isAdult`, the cover URL and relations with batched GraphQL (`media(id_in: …)`, 50 ids a request). AniList allowed 30 requests a minute on 2026-09-25, so the step paces one request every 2.1 s. It remembers ids AniList doesn't know.
4. **`catalog:covers`** downloads each cover once. It's a separate step that the build doesn't need; a reveal without a cover shows the titles only. It is on hold. AniList's terms prohibit *"hoarding or mass collection"* of its data, so the owner decides whether the game uses AniList's covers, AnimeThemes' images or none ([SECURITY.md](../SECURITY.md#external-services)).
5. **`catalog:build`** brings steps 2 and 3 up to date, assembles the rows in one pure function (`scripts/catalog/assemble.ts`, so the same inputs always give the same catalog), writes `catalog.sqlite` beside the old one and renames it into place, regenerates the schema doc, and prints a report for review.
6. **`catalog:check`** is the gate. It requires:
   - at least 99% of the audio files matched to a theme
   - a popularity for at least 95% of the anime
   - at least one playable theme, and a title for every playable anime
   - no adult anime
   - at least 95% of a seeded sample of 200 playable files within −16 ± 2 LUFS. A file ffmpeg can't measure counts as outside.

   A genre with fewer than 50 playable themes is only a warning, and the settings don't offer it. If the loudness rule ever fails, the fix is a per-file gain, measured with ffmpeg's `ebur128` filter and applied when a clip is cut.
7. **`catalog:export`** (M8) writes the primary file of every playable theme for the VPS, re-encoded to 128 kbps Opus under the same relative paths, together with `catalog.sqlite` and `covers/`.

**Franchises** are connected groups of anime, and two anime join when:
- they share an AnimeThemes series, or
- AniList relates them to each other as prequel, sequel, parent, side story, spin-off, alternative, summary or compilation, or
- both relate to the same AniList entry outside the catalog, such as a special between two seasons that has no audio. Only prequel, sequel, parent, summary and compilation count here.

Side stories and spin-offs don't bridge through outside entries, because crossover specials hang off them: *Lupin the 3rd vs. Detective Conan* would otherwise merge Lupin, Conan and Cat's Eye. "Character" and "other" relations never count, because they chain unrelated shows together.

On the 2026-09-25 build, the bridging rule rejoined splits such as Dragon Maid / Dragon Maid S and Haikyu!! / To the Top, and the crossover rule kept Conan, Lupin and Cat's Eye apart. Hard mode builds its options from franchises, so the build report lists the 20 largest groups for review.

**Difficulty.** Each playable theme gets `0.7 × popularity rank + 0.15 × (1 for an ED) + 0.15 × min(sequence − 1, 5) / 5`. The popularity rank runs from 0 for the most popular playable anime to 1 for the least. Themes are then ranked by that score from 0 (easiest) to 1 (hardest), so the presets are simple cuts ([questions](../product-specs/questions.md)).

**Same song.** Each song has an `identity_key`: its title and artists, normalized (Unicode NFKC, lower case, no spaces, punctuation or symbols). Two themes are the same song when they share an AnimeThemes song id or that key. A recap movie can reuse a TV opening under a separate song entry.

A third of AnimeThemes' songs have no artist credits. For those, the key is the title plus the franchise, because a bare title like "Reason" or "Destiny" names different songs in different shows. Within one franchise, the same title is the same song: every Sailor Moon season shares "Moonlight Densetsu". That case matters most, because Hard mode draws options from the answer's franchise.

## Alternatives considered
- **Querying AnimeThemes and AniList at runtime:** rejected. Games would depend on third-party uptime, and players' requests would reach third parties.
- **A database server:** rejected ([system design](system-design.md)).
- **Keeping adult anime with a flag:** rejected. Every query would have to remember the flag, and one that forgot could show an adult title as an option.
- **Normalizing loudness for every file:** rejected, because the audio already measures about −16 LUFS. The gate checks a sample instead.

## Consequences
- **Refresh:** when the library changes (a new season, say), rerun `catalog:sync-animethemes` (or import a newer dump) and `catalog:build` on the machine that holds the full library. Then run `catalog:check`, and export and upload the result (M8).
- The first build, on 2026-09-25, imported Anagroove's dump, because the AnimeThemes API answered HTTP 522 all day. Its franchises therefore come from AniList relations alone. A later live sync adds AnimeThemes series.
- Franchise mistakes show up directly in Hard mode, so the report's franchise list gets a look after any build that adds many anime.
- The catalog is never committed. Tests build their own catalogs in code ([TESTING.md](../TESTING.md)).
