// Builders for catalog test data. Everything is written in code, so no fixture file is ever committed.
import type { AniListMedia } from '../../scripts/catalog/anilist.ts';
import type { AtAnime, AtTheme } from '../../scripts/catalog/animethemes.ts';
import type { ProbedFile } from '../../scripts/catalog/audio.ts';
import type { HttpClient } from '../../scripts/catalog/http.ts';

export function theme(id: number, basename: string, overrides: Partial<AtTheme> = {}): AtTheme {
  return {
    id,
    kind: 'OP',
    sequence: 1,
    slug: 'OP1',
    song: { id, title: `Song ${id}`, artists: [{ id: 1, name: 'Artist', creditedAs: null }] },
    videos: [{ basename: `${basename}.webm`, entryVersion: 1 }],
    ...overrides,
  };
}

export function anime(id: number, overrides: Partial<AtAnime> = {}): AtAnime {
  return {
    id,
    name: `Anime ${id}`,
    slug: `anime_${id}`,
    year: 2020,
    season: 'Spring',
    mediaFormat: 'TV',
    anilistId: 1000 + id,
    malId: null,
    series: [],
    synonyms: [],
    coverUrl: null,
    themes: [],
    ...overrides,
  };
}

export function media(id: number, overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id,
    isAdult: false,
    popularity: 1000,
    genres: ['Action'],
    synonyms: [],
    title: { romaji: `Romaji ${id}`, english: `English ${id}`, native: `Native ${id}` },
    relations: [],
    ...overrides,
  };
}

export function probed(relPath: string, durationMs: number | null = 90_000): ProbedFile {
  return { relPath, size: 1000, mtimeMs: 1, durationMs };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export interface FakeHttp extends HttpClient {
  requests: { url: string; init: RequestInit }[];
  sleeps: number[];
}

// Answers requests from a list, in order, and records each request and each sleep.
export function fakeHttp(responses: (Response | Error)[]): FakeHttp {
  const requests: FakeHttp['requests'] = [];
  const sleeps: number[] = [];
  let next = 0;
  return {
    requests,
    sleeps,
    fetch: async (url, init) => {
      requests.push({ url, init });
      const response = responses[next++];
      if (response === undefined) throw new Error('the fake has no more responses');
      if (response instanceof Error) throw response;
      return response;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
}
