// The games this device finished, and every anime heard in them (docs/product-specs/game-log.md). Kept on the
// device only, like the device settings: no account, nothing on the server. The newest game comes first, and
// only the last hundred are kept.
import type { LobbyState, RevealDetails } from '../../shared/protocol.ts';
import type { ThemeKind } from '../../shared/settings.ts';
import { isRecord } from '../../shared/validate.ts';
import { sharedPlaces } from '../format.ts';
import { readJson, writeItem } from '../storage.ts';

export type AnimeTitles = RevealDetails['anime'];

export interface LoggedSong {
  anime: AnimeTitles;
  slug: string;
  kind: ThemeKind;
  sequence: number;
  title: string | null; // the song's own title
  right: boolean; // this player picked the anime
}

export interface LoggedGame {
  id: string; // the lobby and its game count, so a return to the same results is logged once
  at: number; // when the results came, in ms since the epoch
  place: number;
  players: number;
  score: number;
  songs: LoggedSong[];
}

export interface LoggedAnime {
  slug: string;
  anime: AnimeTitles;
  heard: number;
  right: number;
}

export const MAX_GAMES = 100;

// Released storage keys are permanent.
const HISTORY_KEY = 'ysto_history';

const isText = (value: unknown): value is string => typeof value === 'string';
const isTextOrNull = (value: unknown): value is string | null => value === null || isText(value);

function isAnime(value: unknown): value is AnimeTitles {
  return isRecord(value) && isTextOrNull(value.english) && isText(value.romaji) && isTextOrNull(value.japanese);
}

function isSong(value: unknown): value is LoggedSong {
  return (
    isRecord(value) &&
    isAnime(value.anime) &&
    isText(value.slug) &&
    (value.kind === 'OP' || value.kind === 'ED') &&
    typeof value.sequence === 'number' &&
    isTextOrNull(value.title) &&
    typeof value.right === 'boolean'
  );
}

function isGame(value: unknown): value is LoggedGame {
  return (
    isRecord(value) &&
    isText(value.id) &&
    ['at', 'place', 'players', 'score'].every((key) => typeof value[key] === 'number') &&
    Array.isArray(value.songs) &&
    value.songs.every(isSong)
  );
}

// A game stored by another version, or edited by hand, is left out rather than shown half right.
export function readHistory(storage: Storage | null): LoggedGame[] {
  const stored = readJson(storage, HISTORY_KEY);
  return Array.isArray(stored) ? stored.filter(isGame).slice(0, MAX_GAMES) : [];
}

// The finished game as this player saw it, or null for one they only watched or where no round played.
export function gameOf(lobby: LobbyState, at: number): LoggedGame | null {
  const results = lobby.game?.results ?? [];
  const songs = lobby.game?.songs ?? [];
  const rank = results.findIndex((result) => result.playerId === lobby.you);
  if (rank < 0 || songs.length === 0) return null;
  const places = sharedPlaces(results.map((result) => result.score));
  return {
    id: `${lobby.code}:${lobby.tally?.games ?? 0}`,
    at,
    place: places[rank] ?? rank + 1,
    players: results.length,
    score: results[rank]?.score ?? 0,
    songs: songs.map((song) => ({
      anime: song.anime,
      slug: song.slug,
      kind: song.theme.kind,
      sequence: song.theme.sequence,
      title: song.song.title,
      right: song.right.includes(lobby.you),
    })),
  };
}

// Adds the game in front, unless it is the newest one already (the player came back to its results).
export function logGame(storage: Storage | null, game: LoggedGame): LoggedGame[] {
  const history = readHistory(storage);
  if (history[0]?.id === game.id) return history;
  const next = [game, ...history].slice(0, MAX_GAMES);
  writeItem(storage, HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(storage: Storage | null): void {
  writeItem(storage, HISTORY_KEY, null);
}

// Every anime in the log, most heard first, then most missed, then by name.
export function animeLog(history: LoggedGame[]): LoggedAnime[] {
  const bySlug = new Map<string, LoggedAnime>();
  for (const song of history.flatMap((game) => game.songs)) {
    const entry = bySlug.get(song.slug) ?? { slug: song.slug, anime: song.anime, heard: 0, right: 0 };
    entry.heard++;
    if (song.right) entry.right++;
    bySlug.set(song.slug, entry);
  }
  return [...bySlug.values()].sort(
    (a, b) => b.heard - a.heard || a.right - b.right || a.anime.romaji.localeCompare(b.anime.romaji),
  );
}
