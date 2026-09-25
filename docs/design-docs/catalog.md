---
status: draft
last-verified: 2026-09-25
---

# Catalog

## Context
The audio library is a set of `.ogg` files in the AnimeThemes layout: `<year>/<Season>/<Basename>.ogg` from 2000 on, and `<decade>/` for the 60s–90s. The files are Opus, 48 kHz stereo, about 315 kbps. `YSTO_AUDIO_DIR` points at the library, which stays outside the repo and is never committed. Metadata comes from the AnimeThemes API (Anagroove keeps a dump of it, fetched on 2026-09-19). A survey on 2026-09-25 found:
- **Matching:** almost every file matches a theme by its basename. The rest are duplicates (`.1` copies) and theatrical variants. Some themes have more than one file, such as a `-NCBD1080` variant.
- **Durations:** mostly TV size, around 90 s. A few percent are under 45 s, and a few run past 2 minutes.
- **Tags and loudness:** the files carry only an encoder tag, and a random sample measured about −16 LUFS integrated, so the audio already looks normalized.
- **AnimeThemes metadata:** 4,940 anime and 14,447 themes (5,585 OP, 8,862 ED). Each anime has one display name (mostly romaji) and external IDs, but no English or Japanese titles, genres, popularity, franchise grouping or cover art. 4,934 anime have an AniList ID, and AniList supplies the missing fields.
- **Concentration:** Detective Conan has 79 themes, One Piece 73, Naruto Shippuuden 60 and Bleach 45. The 145 anime with 10 or more themes hold 2,320 themes (16%).
- **Shared songs:** 94 songs are credited to more than one anime, for example Date A Live and its OVA.
- **Formats and years:** TV 3,545, Movie 430, OVA 355, TV Short 331, ONA 198, Special 81. Years run from 1963 to 2026.

## Decision
**Stores.**

| Store | Contents | Written by | At runtime | In git |
| :-- | :-- | :-- | :-- | :-- |
| `catalog.sqlite` | anime, themes, songs, artists, genres, audio files, difficulty | `npm run catalog:build` | mounted read-only, loaded into memory at startup | never |
| `covers/` | one cover image per anime | `npm run catalog:covers` | read-only, served at `/covers` | never |
| Audio library | the source `.ogg` files; on the VPS, the exported copy | the owner, `npm run catalog:export` | read-only | never |
| `data/cache/` | raw AnimeThemes and AniList responses | ingest scripts | not mounted | never |

**Schema (v1).** The build writes the real schema to `docs/generated/catalog-schema.md`.
```sql
CREATE TABLE catalog_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- schema_version, built_at, source dates, counts

CREATE TABLE franchise (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE anime (
  id             INTEGER PRIMARY KEY,           -- AnimeThemes anime id
  slug           TEXT NOT NULL UNIQUE,
  title_display  TEXT NOT NULL,                 -- AnimeThemes name, mostly romaji
  title_romaji   TEXT,
  title_english  TEXT,
  title_native   TEXT,                          -- Japanese
  synonyms_json  TEXT NOT NULL DEFAULT '[]',
  media_format   TEXT NOT NULL,                 -- TV, TV Short, Movie, OVA, ONA, Special
  year           INTEGER,
  season         TEXT,                          -- Winter, Spring, Summer, Fall
  franchise_id   INTEGER REFERENCES franchise(id),
  anilist_id     INTEGER,
  mal_id         INTEGER,
  popularity     INTEGER,                       -- AniList: users with it on their list
  popularity_pct REAL,                          -- 0 most popular .. 1 least, among playable anime
  is_adult       INTEGER NOT NULL DEFAULT 0,
  cover_file     TEXT                           -- relative to covers/
);

CREATE TABLE genre       (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE anime_genre (anime_id INTEGER NOT NULL REFERENCES anime(id),
                          genre_id INTEGER NOT NULL REFERENCES genre(id),
                          PRIMARY KEY (anime_id, genre_id));

CREATE TABLE artist      (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE song        (id INTEGER PRIMARY KEY,
                          title TEXT NOT NULL,
                          identity_key TEXT NOT NULL);  -- normalized title + artists, for the same-song rule
CREATE TABLE song_artist (song_id     INTEGER NOT NULL REFERENCES song(id),
                          artist_id   INTEGER NOT NULL REFERENCES artist(id),
                          position    INTEGER NOT NULL,
                          credited_as TEXT,
                          PRIMARY KEY (song_id, artist_id));

CREATE TABLE theme (
  id         INTEGER PRIMARY KEY,               -- AnimeThemes theme id
  anime_id   INTEGER NOT NULL REFERENCES anime(id),
  song_id    INTEGER REFERENCES song(id),
  kind       TEXT NOT NULL CHECK (kind IN ('OP', 'ED')),
  sequence   INTEGER NOT NULL,
  slug       TEXT NOT NULL,                     -- OP1, ED2
  difficulty REAL                               -- 0 easiest .. 1 hardest
);

CREATE TABLE audio_file (
  id            INTEGER PRIMARY KEY,
  theme_id      INTEGER NOT NULL REFERENCES theme(id),
  rel_path      TEXT NOT NULL UNIQUE,           -- relative to YSTO_AUDIO_DIR, forward slashes
  duration_ms   INTEGER NOT NULL,
  loudness_lufs REAL,                           -- set only where measured
  size_bytes    INTEGER NOT NULL,
  is_primary    INTEGER NOT NULL DEFAULT 0      -- the one file a theme plays from
);

CREATE INDEX anime_year      ON anime(year);
CREATE INDEX anime_franchise ON anime(franchise_id);
CREATE INDEX anime_anilist   ON anime(anilist_id);
CREATE INDEX song_identity   ON song(identity_key);
CREATE INDEX theme_anime     ON theme(anime_id);
CREATE INDEX theme_song      ON theme(song_id);
CREATE INDEX audio_theme     ON audio_file(theme_id);
```

**Ingest pipeline.** `npm run catalog:build` runs these steps in order. Each step is also its own script, can resume, and is safe to rerun. Raw responses are cached in `YSTO_CACHE_DIR`, so a rerun doesn't fetch them again.
1. **`catalog:sync-animethemes`** pages through `api.animethemes.moe/anime`, including songs, artists, entries, videos, resources, series and synonyms. That's about 50 requests of 100 anime, one per second, with a User-Agent that names the repo. `--from-dump <file>` imports an existing dump instead.
2. **`catalog:scan-audio`** matches file basenames to AnimeThemes videos. It reads durations with ffprobe (in parallel, cached by path, size and mtime), picks one primary file per theme, and lists unmatched files.
3. **`catalog:enrich-anilist`** sends batched GraphQL queries (`Page(perPage: 50) { media(id_in: …) }`), about 100 requests in total. They fetch titles (romaji, English, native), synonyms, genres, popularity, `isAdult`, the cover image and relations. The requests stay under AniList's rate limit and back off on 429, using `Retry-After`.
4. **`catalog:covers`** downloads each cover once into `covers/`.
5. **Assembly** writes a new `catalog.sqlite` next to the old one and renames it into place. It computes franchises, song identity keys, popularity percentiles and difficulty, fills `catalog_meta`, prints a report, and regenerates the schema doc.
6. **`catalog:check`** is the gate. It requires:
   - at least 99% of files matched
   - a display title for every playable anime
   - popularity for at least 95% of anime
   - no playable adult anime
   - at least 50 themes for every genre offered in the settings
   - integrated loudness within −16 ± 2 LUFS on 200 random files

   If the loudness check fails, a per-file gain is added, measured with ffmpeg's `ebur128` filter and applied when a clip is cut.
7. **`catalog:export`** (for the VPS) writes the primary file of every playable theme, re-encoded to 128 kbps Opus under the same relative paths. It adds `catalog.sqlite` and `covers/`, so the whole folder is ready for `rsync`.

**Franchises** come from the AnimeThemes `series` where it is set. Otherwise they are connected components over AniList relations of these types: prequel, sequel, parent, side story, spin-off, alternative, summary and compilation. The "character" and "other" relations are left out because they chain unrelated shows together. Both sources are checked against known franchises (Naruto, Gundam, Monogatari, Fate, Detective Conan), and the 20 largest groups are reviewed by hand, because Hard mode builds its options from franchises.

**Difficulty.** Each theme's score combines the anime's AniList popularity percentile, OP or ED (endings are less well known), and the sequence number (OP1 is better known than OP9). The presets are cuts over it ([questions](../product-specs/questions.md)).

**Same song.** Two themes are the same song when they share an AnimeThemes song ID or a normalized title-and-artists key (`identity_key`). A recap movie can reuse a TV opening under a separate song entry.

## Alternatives considered
- **Querying AnimeThemes and AniList at runtime:** rejected. Games would depend on third-party uptime, and players' requests would reach third parties.
- **A database server:** rejected ([system design](system-design.md)).
- **Normalizing loudness for every file:** rejected, because the audio already measures about −16 LUFS. The gate checks a sample instead.

## Consequences
- **Refresh:** when the library changes (a new season, say), rerun `catalog:build` and `catalog:export` on the machine that holds the full library, rsync the result, and restart the container.
- Franchise mistakes show up directly in Hard mode, so the franchise review is part of every build that adds many anime.
- The catalog is never committed. Tests build their own catalogs in code ([TESTING.md](../TESTING.md)).
