// Turns the cached sources into catalog rows: matches audio files to themes, groups anime into
// franchises, keys songs by identity, and ranks popularity and difficulty. It is pure: the same inputs
// always give the same rows, which makes the build reproducible and testable.
import { isAdultMedia } from './anilist.ts';
import type { AniListMedia } from './anilist.ts';
import type { AtAnime, AtArtist, AtSong } from './animethemes.ts';
import type { ProbedFile } from './audio.ts';

// The shortest sample (10 s) plus the 3 s lead-in and 5 s tail that sample offsets keep clear.
export const MIN_PLAYABLE_MS = 18_000;

// AniList relations that join two anime of the catalog into one franchise. CHARACTER and OTHER are
// left out because they chain unrelated shows together.
export const FRANCHISE_RELATIONS: ReadonlySet<string> = new Set([
  'PREQUEL',
  'SEQUEL',
  'PARENT',
  'SIDE_STORY',
  'SPIN_OFF',
  'ALTERNATIVE',
  'SUMMARY',
  'COMPILATION',
]);

// The relations that may also join two anime through an AniList entry outside the catalog, such as a
// special between two seasons. Side stories and spin-offs are left out here, because crossover specials
// ("Lupin the 3rd vs. Detective Conan") hang off them and would merge unrelated franchises.
export const BRIDGING_RELATIONS: ReadonlySet<string> = new Set([
  'PREQUEL',
  'SEQUEL',
  'PARENT',
  'SUMMARY',
  'COMPILATION',
]);

// Difficulty weights (docs/design-docs/catalog.md): how well known the anime is, then OP or ED, then
// how late in the run the theme came, capped at the sixth.
const WEIGHT_POPULARITY = 0.7;
const WEIGHT_ENDING = 0.15;
const WEIGHT_SEQUENCE = 0.15;
const SEQUENCE_CAP = 5;
const LARGEST_FRANCHISES_REPORTED = 20;
const MEMBERS_REPORTED = 12;

export interface CatalogInputs {
  animeThemes: AtAnime[];
  aniList: ReadonlyMap<number, AniListMedia>;
  audio: ProbedFile[];
  coverFiles: ReadonlyMap<number, string>; // cover file names by AnimeThemes anime id
}

export interface FranchiseRow {
  id: number;
  name: string;
}

export interface AnimeRow {
  id: number;
  slug: string;
  titleDisplay: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[];
  mediaFormat: string;
  year: number | null;
  season: string | null;
  franchiseId: number;
  anilistId: number | null;
  malId: number | null;
  popularity: number | null;
  popularityPct: number | null;
  coverFile: string | null;
  genres: string[];
}

export interface ArtistCredit {
  artistId: number;
  name: string;
  position: number;
  creditedAs: string | null;
}

export interface SongRow {
  id: number;
  title: string | null;
  identityKey: string;
  artists: ArtistCredit[];
}

export interface ThemeRow {
  id: number;
  animeId: number;
  songId: number | null;
  kind: 'OP' | 'ED';
  sequence: number;
  slug: string;
  difficulty: number | null;
}

export interface AudioFileRow {
  relPath: string;
  themeId: number;
  durationMs: number;
  sizeBytes: number;
  isPrimary: boolean;
}

export interface CatalogReport {
  audioFiles: number;
  matchedFiles: number;
  unmatchedFiles: string[];
  unreadableFiles: number;
  animeTotal: number;
  adultAnimeExcluded: number;
  animeInCatalog: number;
  animeWithPopularity: number;
  playableAnime: number;
  themesInCatalog: number;
  playableThemes: number;
  shortThemes: number;
  franchises: number;
  largestFranchises: { name: string; size: number; members: string[] }[];
}

export interface CatalogData {
  franchises: FranchiseRow[];
  anime: AnimeRow[];
  songs: SongRow[];
  themes: ThemeRow[];
  audioFiles: AudioFileRow[];
  report: CatalogReport;
}

interface VideoMatch {
  themeId: number;
  animeId: number;
  entryVersion: number;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function basenameKey(pathOrName: string): string {
  const name = pathOrName.slice(pathOrName.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).toLowerCase();
}

export function normalizeForIdentity(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

// Two songs are the same when their titles and artists match after normalization. A recap movie can
// reuse a TV opening under a separate AnimeThemes song entry, and this key still pairs them. A third
// of AnimeThemes songs have no artist credits, and a bare title ("Reason", "Destiny") is too common to
// pair songs across shows, so without artists the key only pairs songs within one franchise.
export function identityKey(song: AtSong, franchiseId: number): string {
  const title = song.title === null ? '' : normalizeForIdentity(song.title);
  if (title === '') return `song:${song.id}`;
  if (song.artists.length === 0) return `${title}|franchise:${franchiseId}`;
  const artists = song.artists.map((artist) => normalizeForIdentity(artist.name)).sort();
  return `${title}|${artists.join(',')}`;
}

// Indexes every anime's videos, adult ones included, so their audio files count as matched even
// though the catalog leaves them out.
function indexVideos(animeList: AtAnime[]): Map<string, VideoMatch> {
  const index = new Map<string, VideoMatch>();
  for (const anime of animeList) {
    for (const theme of anime.themes) {
      for (const video of theme.videos) {
        const key = basenameKey(video.basename);
        if (!index.has(key)) index.set(key, { themeId: theme.id, animeId: anime.id, entryVersion: video.entryVersion });
      }
    }
  }
  return index;
}

// Matched files per theme; the first of each theme (lowest entry version, then path) is its primary.
function audioFileRows(audio: ProbedFile[], index: Map<string, VideoMatch>, included: Set<number>): AudioFileRow[] {
  const byTheme = new Map<number, { file: ProbedFile; durationMs: number; entryVersion: number }[]>();
  for (const file of audio) {
    const match = index.get(basenameKey(file.relPath));
    if (!match || !included.has(match.animeId) || file.durationMs === null) continue;
    const entries = byTheme.get(match.themeId) ?? [];
    entries.push({ file, durationMs: file.durationMs, entryVersion: match.entryVersion });
    byTheme.set(match.themeId, entries);
  }
  const rows: AudioFileRow[] = [];
  for (const [themeId, entries] of byTheme) {
    entries.sort((a, b) => a.entryVersion - b.entryVersion || compareStrings(a.file.relPath, b.file.relPath));
    entries.forEach((entry, position) =>
      rows.push({
        relPath: entry.file.relPath,
        themeId,
        durationMs: entry.durationMs,
        sizeBytes: entry.file.size,
        isPrimary: position === 0,
      }),
    );
  }
  return rows.sort((a, b) => compareStrings(a.relPath, b.relPath));
}

// Union-find whose nodes are anime, AniList entries and AnimeThemes series. AniList entries outside
// the catalog are nodes too, so two seasons that both relate to a special without audio still end up
// in one franchise (BRIDGING_RELATIONS). The franchise id is the smallest anime id in each group.
function franchiseOfEach(
  included: AtAnime[],
  media: (anime: AtAnime) => AniListMedia | undefined,
): Map<number, number> {
  const inCatalog = new Set(included.flatMap((anime) => (anime.anilistId === null ? [] : [anime.anilistId])));
  const joins = (relation: { type: string; animeId: number }) =>
    (inCatalog.has(relation.animeId) ? FRANCHISE_RELATIONS : BRIDGING_RELATIONS).has(relation.type);
  const parent = new Map<string, string>();
  const find = (node: string): string => {
    let root = node;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root) ?? root;
    parent.set(node, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const [rootA, rootB] = [find(a), find(b)];
    if (rootA !== rootB) parent.set(rootA, rootB);
  };
  for (const anime of included) {
    const node = `anime:${anime.id}`;
    find(node);
    if (anime.anilistId !== null) union(node, `anilist:${anime.anilistId}`);
    for (const series of anime.series) union(node, `series:${series.id}`);
    for (const relation of media(anime)?.relations ?? []) {
      if (joins(relation)) union(node, `anilist:${relation.animeId}`);
    }
  }
  const smallestInGroup = new Map<string, number>();
  for (const anime of included) {
    const root = find(`anime:${anime.id}`);
    smallestInGroup.set(root, Math.min(smallestInGroup.get(root) ?? anime.id, anime.id));
  }
  return new Map(included.map((anime) => [anime.id, smallestInGroup.get(find(`anime:${anime.id}`)) ?? anime.id]));
}

function preferredTitle(anime: AtAnime, media: AniListMedia | undefined): string {
  return media?.title.english ?? media?.title.romaji ?? anime.name;
}

// Ranks items from 0 (first) to 1 (last).
function percentiles<T>(items: T[], compare: (a: T, b: T) => number): Map<T, number> {
  const sorted = [...items].sort(compare);
  const last = Math.max(1, sorted.length - 1);
  return new Map(sorted.map((item, index) => [item, index / last]));
}

// A song shared by several anime takes the franchise of the first one (lowest id) for its key.
function songRows(included: AtAnime[], franchiseOf: Map<number, number>): SongRow[] {
  const songs = new Map<number, SongRow>();
  for (const anime of included) {
    for (const theme of anime.themes) {
      if (!theme.song || songs.has(theme.song.id)) continue;
      songs.set(theme.song.id, songRow(theme.song, franchiseOf.get(anime.id) ?? anime.id));
    }
  }
  return [...songs.values()].sort((a, b) => a.id - b.id);
}

function songRow(song: AtSong, franchiseId: number): SongRow {
  const artists: AtArtist[] = [];
  for (const artist of song.artists) {
    if (!artists.some((kept) => kept.id === artist.id)) artists.push(artist);
  }
  return {
    id: song.id,
    title: song.title,
    identityKey: identityKey(song, franchiseId),
    artists: artists.map((artist, position) => ({
      artistId: artist.id,
      name: artist.name,
      position,
      creditedAs: artist.creditedAs,
    })),
  };
}

function themeDifficulty(theme: ThemeRow, popularityPct: number): number {
  const lateness = Math.min(Math.max(theme.sequence - 1, 0), SEQUENCE_CAP) / SEQUENCE_CAP;
  return WEIGHT_POPULARITY * popularityPct + WEIGHT_ENDING * (theme.kind === 'ED' ? 1 : 0) + WEIGHT_SEQUENCE * lateness;
}

function franchiseRows(
  included: AtAnime[],
  franchiseOf: Map<number, number>,
  media: (anime: AtAnime) => AniListMedia | undefined,
): FranchiseRow[] {
  const members = new Map<number, AtAnime[]>();
  for (const anime of included) {
    const id = franchiseOf.get(anime.id) ?? anime.id;
    members.set(id, [...(members.get(id) ?? []), anime]);
  }
  return [...members.entries()]
    .map(([id, group]) => {
      const series = group.flatMap((anime) => anime.series)[0];
      const mostPopular = [...group].sort(
        (a, b) => (media(b)?.popularity ?? -1) - (media(a)?.popularity ?? -1) || a.id - b.id,
      )[0];
      const name = series?.name ?? (mostPopular ? preferredTitle(mostPopular, media(mostPopular)) : String(id));
      return { id, name };
    })
    .sort((a, b) => a.id - b.id);
}

function largestFranchises(anime: AnimeRow[], franchises: FranchiseRow[]): CatalogReport['largestFranchises'] {
  const names = new Map(franchises.map((franchise) => [franchise.id, franchise.name]));
  const members = new Map<number, string[]>();
  for (const row of anime) {
    members.set(row.franchiseId, [...(members.get(row.franchiseId) ?? []), row.titleEnglish ?? row.titleDisplay]);
  }
  return [...members.entries()]
    .map(([id, titles]) => ({
      name: names.get(id) ?? String(id),
      size: titles.length,
      members: titles.sort(compareStrings),
    }))
    .sort((a, b) => b.size - a.size || compareStrings(a.name, b.name))
    .slice(0, LARGEST_FRANCHISES_REPORTED)
    .map((group) => ({ ...group, members: group.members.slice(0, MEMBERS_REPORTED) }));
}

export function assembleCatalog(inputs: CatalogInputs): CatalogData {
  const media = (anime: AtAnime) => (anime.anilistId === null ? undefined : inputs.aniList.get(anime.anilistId));
  const included = inputs.animeThemes.filter((anime) => !isAdultMedia(media(anime))).sort((a, b) => a.id - b.id);
  const includedIds = new Set(included.map((anime) => anime.id));
  const index = indexVideos(inputs.animeThemes);
  const audioFiles = audioFileRows(inputs.audio, index, includedIds);
  const franchiseOf = franchiseOfEach(included, media);
  const franchises = franchiseRows(included, franchiseOf, media);

  const themes = included
    .flatMap((anime) =>
      anime.themes.map((theme): ThemeRow => ({
        id: theme.id,
        animeId: anime.id,
        songId: theme.song?.id ?? null,
        kind: theme.kind,
        sequence: theme.sequence,
        slug: theme.slug,
        difficulty: null,
      })),
    )
    .sort((a, b) => a.id - b.id);

  const primaryDuration = new Map(
    audioFiles.filter((file) => file.isPrimary).map((file) => [file.themeId, file.durationMs]),
  );
  const playableThemes = themes.filter((theme) => (primaryDuration.get(theme.id) ?? 0) >= MIN_PLAYABLE_MS);
  const playableAnimeIds = new Set(playableThemes.map((theme) => theme.animeId));
  const playableAnime = included.filter((anime) => playableAnimeIds.has(anime.id));
  const popularityPct = percentiles(
    playableAnime,
    (a, b) => (media(b)?.popularity ?? -1) - (media(a)?.popularity ?? -1) || a.id - b.id,
  );
  const pctByAnimeId = new Map([...popularityPct].map(([anime, pct]) => [anime.id, pct]));

  const rawDifficulty = new Map(
    playableThemes.map((theme) => [theme, themeDifficulty(theme, pctByAnimeId.get(theme.animeId) ?? 1)]),
  );
  const difficulty = percentiles(
    playableThemes,
    (a, b) => (rawDifficulty.get(a) ?? 0) - (rawDifficulty.get(b) ?? 0) || a.id - b.id,
  );
  for (const [theme, rank] of difficulty) theme.difficulty = rank;

  const anime: AnimeRow[] = included.map((entry) => {
    const info = media(entry);
    return {
      id: entry.id,
      slug: entry.slug,
      titleDisplay: entry.name,
      titleRomaji: info?.title.romaji ?? null,
      titleEnglish: info?.title.english ?? null,
      titleNative: info?.title.native ?? null,
      synonyms: [...new Set([...entry.synonyms, ...(info?.synonyms ?? [])])],
      mediaFormat: entry.mediaFormat ?? 'Unknown',
      year: entry.year,
      season: entry.season,
      franchiseId: franchiseOf.get(entry.id) ?? entry.id,
      anilistId: entry.anilistId,
      malId: entry.malId,
      popularity: info?.popularity ?? null,
      popularityPct: pctByAnimeId.get(entry.id) ?? null,
      coverFile: inputs.coverFiles.get(entry.id) ?? null,
      genres: [...new Set(info?.genres ?? [])].sort(compareStrings),
    };
  });

  const matchedFiles = inputs.audio.filter((file) => index.has(basenameKey(file.relPath)));
  const report: CatalogReport = {
    audioFiles: inputs.audio.length,
    matchedFiles: matchedFiles.length,
    unmatchedFiles: inputs.audio.filter((file) => !index.has(basenameKey(file.relPath))).map((file) => file.relPath),
    unreadableFiles: inputs.audio.filter((file) => file.durationMs === null).length,
    animeTotal: inputs.animeThemes.length,
    adultAnimeExcluded: inputs.animeThemes.length - included.length,
    animeInCatalog: anime.length,
    animeWithPopularity: anime.filter((row) => row.popularity !== null).length,
    playableAnime: playableAnime.length,
    themesInCatalog: themes.length,
    playableThemes: playableThemes.length,
    shortThemes: primaryDuration.size - playableThemes.length,
    franchises: franchises.length,
    largestFranchises: largestFranchises(anime, franchises),
  };

  return { franchises, anime, songs: songRows(included, franchiseOf), themes, audioFiles, report };
}
