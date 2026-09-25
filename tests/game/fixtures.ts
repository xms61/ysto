// Catalogs for game tests, built in code: small hand-made ones, and a seeded synthetic one shaped like the
// real catalog (franchises of every size, remakes sharing a title, songs shared within and across
// franchises, missing English titles, themes too short to play).
import type { Catalog, CatalogAnime, CatalogTheme } from '../../server/catalog/load.ts';
import { pick, seededRandom } from '../../server/game/random.ts';
import { defaultSettings } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';

export function animeEntry(id: number, overrides: Partial<CatalogAnime> = {}): CatalogAnime {
  return {
    id,
    titles: { display: `Show ${id}`, romaji: `Show ${id}`, english: `English ${id}`, native: `Native ${id}` },
    year: 2010,
    season: 'Spring',
    format: 'TV',
    franchiseId: id,
    popularityPct: 0.5,
    popularityRank: 1,
    genres: new Set(['Action']),
    songIds: new Set([id * 10]),
    songKeys: new Set([`song-${id}`]),
    coverFile: null,
    ...overrides,
  };
}

export function themeEntry(id: number, animeId: number, overrides: Partial<CatalogTheme> = {}): CatalogTheme {
  return {
    id,
    animeId,
    songId: animeId * 10,
    songKey: `song-${animeId}`,
    kind: 'OP',
    sequence: 1,
    slug: 'OP1',
    difficulty: 0.1,
    relPath: `2010/Spring/Show${animeId}-OP1.ogg`,
    durationMs: 90_000,
    ...overrides,
  };
}

// Ranks and years are derived the way loadCatalog derives them.
export function catalogOf(anime: CatalogAnime[], themes: CatalogTheme[]): Catalog {
  const byPct = [...anime].sort((a, b) => a.popularityPct - b.popularityPct || a.id - b.id);
  const ranked = anime
    .map((entry) => ({ ...entry, popularityRank: byPct.indexOf(entry) + 1 }))
    .sort((a, b) => a.id - b.id);
  const years = ranked.map((entry) => entry.year).filter((year) => year !== null);
  return {
    anime: new Map(ranked.map((entry) => [entry.id, entry])),
    playableAnime: ranked,
    themes: [...themes].sort((a, b) => a.id - b.id),
    genres: [...new Set(ranked.flatMap((entry) => [...entry.genres]))].sort(),
    years: { from: Math.min(...years), to: Math.max(...years) },
  };
}

export function settingsFor(catalog: Catalog, overrides: Partial<LobbySettings> = {}): LobbySettings {
  return { ...defaultSettings(catalog.years), ...overrides };
}

const GENRES = ['Action', 'Comedy', 'Drama', 'Fantasy', 'Mecha', 'Romance', 'Sci-Fi', 'Sports'];
const FORMATS = ['TV', 'TV', 'TV', 'TV Short', 'ONA', 'Movie', 'OVA', 'Special'];
// Franchise sizes, like the real catalog: many single shows, a few long runs (a Gundam, a Precure).
const FRANCHISE_SIZES = [
  ...Array<number>(60).fill(1),
  ...Array<number>(20).fill(2),
  ...Array<number>(10).fill(4),
  8,
  8,
  8,
  8,
  8,
  16,
  16,
];

interface Draft {
  anime: CatalogAnime;
  themes: CatalogTheme[];
  popularity: number;
}

function draftFranchise(firstId: number, size: number, random: ReturnType<typeof seededRandom>): Draft[] {
  const baseYear = 1980 + random.int(40);
  const drafts: Draft[] = [];
  for (let member = 0; member < size; member++) {
    const id = firstId + member;
    // Long runs get yearly numbered seasons, and every fifth pair of a franchise is a remake that shares a title.
    const title =
      member > 0 && member % 5 === 0
        ? `Show ${firstId}`
        : `Show ${firstId}${member === 0 ? '' : ` Season ${member + 1}`}`;
    const english = random.int(100) < 15 ? null : title.replace('Show', 'English');
    const genres = new Set([pick(GENRES, random), pick(GENRES, random)]);
    const anime = animeEntry(id, {
      titles: {
        display: title,
        romaji: title,
        english,
        native: random.int(100) < 3 ? null : title.replace('Show', 'Native'),
      },
      year: size > 4 ? baseYear + member : baseYear + random.int(6),
      format: pick(FORMATS, random),
      franchiseId: firstId,
      genres,
      songIds: new Set(),
      songKeys: new Set(),
    });
    drafts.push({ anime, themes: [], popularity: random.int(100_000) });
  }
  return drafts;
}

function addThemes(drafts: Draft[], random: ReturnType<typeof seededRandom>, nextThemeId: () => number): void {
  const franchiseOpening = drafts[0]?.anime.id ?? 0;
  for (const draft of drafts) {
    const count = 1 + random.int(5);
    for (let index = 0; index < count; index++) {
      const id = nextThemeId();
      // A fifth of later members reuse the franchise's first opening, as Sailor Moon's seasons do.
      const reusesOpening = index === 0 && draft.anime.id !== franchiseOpening && random.int(5) === 0;
      const songId = reusesOpening ? franchiseOpening * 1000 : id;
      draft.themes.push(
        themeEntry(id, draft.anime.id, {
          songId,
          songKey: `key-${songId}`,
          kind: index % 2 === 0 ? 'OP' : 'ED',
          sequence: 1 + Math.floor(index / 2),
          slug: `${index % 2 === 0 ? 'OP' : 'ED'}${1 + Math.floor(index / 2)}`,
          durationMs: 12_000 + random.int(140_000),
          relPath: `${draft.anime.year}/Show${draft.anime.id}-${index}.ogg`,
        }),
      );
    }
  }
}

// About 200 anime in 99 franchises, fixed for a given seed.
export function syntheticCatalog(seed = 7): Catalog {
  const random = seededRandom(seed);
  let themeId = 0;
  const drafts: Draft[] = [];
  let firstId = 1;
  for (const size of FRANCHISE_SIZES) {
    const franchise = draftFranchise(firstId, size, random);
    addThemes(franchise, random, () => ++themeId);
    drafts.push(...franchise);
    firstId += size;
  }
  // Two songs shared across franchises, like Soul Eater's opening in Fire Force.
  for (const [from, to] of [
    [3, 150],
    [40, 170],
  ] as const) {
    const shared = drafts[from]?.themes[0];
    const target = drafts[to]?.themes[0];
    if (shared && target) Object.assign(target, { songKey: shared.songKey });
  }
  const byPopularity = [...drafts].sort((a, b) => b.popularity - a.popularity);
  const last = drafts.length - 1;
  const anime = drafts.map((draft) => ({
    ...draft.anime,
    popularityPct: byPopularity.indexOf(draft) / last,
    songIds: new Set(draft.themes.map((theme) => theme.songId).filter((id) => id !== null)),
    songKeys: new Set(draft.themes.map((theme) => theme.songKey).filter((key) => key !== null)),
  }));
  const pct = new Map(anime.map((entry) => [entry.id, entry.popularityPct]));
  const playable = drafts.flatMap((draft) => draft.themes).filter((theme) => theme.durationMs >= 18_000);
  const raw = playable.map(
    (theme) =>
      0.7 * (pct.get(theme.animeId) ?? 1) + (theme.kind === 'ED' ? 0.15 : 0) + 0.03 * Math.min(theme.sequence - 1, 5),
  );
  const order = playable.map((_, index) => index).sort((a, b) => (raw[a] ?? 0) - (raw[b] ?? 0));
  const themes = playable.map((theme, index) => ({
    ...theme,
    difficulty: order.indexOf(index) / (playable.length - 1),
  }));
  const withThemes = new Set(themes.map((theme) => theme.animeId));
  return catalogOf(
    anime.filter((entry) => withThemes.has(entry.id)),
    themes,
  );
}
