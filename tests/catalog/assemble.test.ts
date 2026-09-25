import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AniListMedia } from '../../scripts/catalog/anilist.ts';
import type { AtAnime } from '../../scripts/catalog/animethemes.ts';
import { assembleCatalog, identityKey, MIN_PLAYABLE_MS } from '../../scripts/catalog/assemble.ts';
import type { CatalogInputs } from '../../scripts/catalog/assemble.ts';
import { anime, media, probed, theme } from './fixtures.ts';

function inputs(animeList: AtAnime[], mediaList: AniListMedia[], audio = animeList.flatMap(filesFor)): CatalogInputs {
  return {
    animeThemes: animeList,
    aniList: new Map(mediaList.map((entry) => [entry.id, entry])),
    audio,
    coverFiles: new Map(),
  };
}

// One 90 s file per video, named like the AnimeThemes basename.
function filesFor(entry: AtAnime) {
  return entry.themes.flatMap((item) =>
    item.videos.map((video) => probed(`2020/Spring/${video.basename.replace('.webm', '.ogg')}`)),
  );
}

const naruto = anime(1, {
  anilistId: 20,
  themes: [theme(11, 'Naruto-OP1'), theme(12, 'Naruto-ED3', { kind: 'ED', sequence: 3, slug: 'ED3' })],
});
const shippuden = anime(2, { anilistId: 1735, themes: [theme(21, 'Shippuden-OP1')] });
const adult = anime(3, { anilistId: 99, themes: [theme(31, 'Adult-OP1')] });
const narutoMedia = media(20, { popularity: 700_000, relations: [{ type: 'SEQUEL', animeId: 1735 }] });
const shippudenMedia = media(1735, { popularity: 500_000 });
const adultMedia = media(99, { isAdult: true });

test('matches audio files to themes by basename and reports the rest', () => {
  const stray = probed('2020/Spring/Stray-OP1.ogg');
  const data = assembleCatalog(
    inputs([naruto, adult], [narutoMedia, adultMedia], [...filesFor(naruto), ...filesFor(adult), stray]),
  );
  assert.equal(data.report.audioFiles, 4);
  assert.equal(data.report.matchedFiles, 3);
  assert.deepEqual(data.report.unmatchedFiles, ['2020/Spring/Stray-OP1.ogg']);
});

test('leaves adult anime, their themes and their files out of the catalog', () => {
  const data = assembleCatalog(inputs([naruto, adult], [narutoMedia, adultMedia]));
  assert.deepEqual(
    data.anime.map((row) => row.id),
    [1],
  );
  assert.deepEqual(
    data.themes.map((row) => row.id),
    [11, 12],
  );
  assert.equal(
    data.audioFiles.some((file) => file.relPath.includes('Adult')),
    false,
  );
  assert.equal(data.report.adultAnimeExcluded, 1);
});

test("picks the lowest entry version, then the path, as a theme's primary file", () => {
  const versions = anime(4, {
    themes: [
      theme(41, 'Show-OP1v2', {
        videos: [
          { basename: 'Show-OP1v2.webm', entryVersion: 2 },
          { basename: 'Show-OP1-NCBD.webm', entryVersion: 1 },
          { basename: 'Show-OP1.webm', entryVersion: 1 },
        ],
      }),
    ],
  });
  const data = assembleCatalog(inputs([versions], []));
  assert.deepEqual(
    data.audioFiles.map((file) => [file.relPath, file.isPrimary]),
    [
      ['2020/Spring/Show-OP1-NCBD.ogg', true],
      ['2020/Spring/Show-OP1.ogg', false],
      ['2020/Spring/Show-OP1v2.ogg', false],
    ],
  );
});

test(`only themes whose primary file lasts at least ${MIN_PLAYABLE_MS / 1000} s are playable`, () => {
  const short = anime(5, { themes: [theme(51, 'Short-OP1'), theme(52, 'Long-OP1')] });
  const audio = [probed('Short-OP1.ogg', MIN_PLAYABLE_MS - 1), probed('Long-OP1.ogg', MIN_PLAYABLE_MS)];
  const data = assembleCatalog(inputs([short], [], audio));
  assert.deepEqual(
    data.themes.map((row) => [row.id, row.difficulty !== null]),
    [
      [51, false],
      [52, true],
    ],
  );
  assert.equal(data.report.shortThemes, 1);
  assert.equal(data.report.playableThemes, 1);
});

test('groups anime into franchises through AniList relations and AnimeThemes series', () => {
  const monogatari = anime(6, { series: [{ id: 70, name: 'Monogatari' }], themes: [theme(61, 'Bake-OP1')] });
  const nisemonogatari = anime(7, { series: [{ id: 70, name: 'Monogatari' }], themes: [theme(71, 'Nise-OP1')] });
  const data = assembleCatalog(inputs([naruto, shippuden, monogatari, nisemonogatari], [narutoMedia, shippudenMedia]));
  assert.deepEqual(
    data.anime.map((row) => [row.id, row.franchiseId]),
    [
      [1, 1],
      [2, 1],
      [6, 6],
      [7, 6],
    ],
  );
  assert.deepEqual(data.franchises, [
    { id: 1, name: 'English 20' },
    { id: 6, name: 'Monogatari' },
  ]);
});

test('joins anime that relate to the same AniList entry outside the catalog', () => {
  const dragonMaid = anime(10, { anilistId: 21776, themes: [theme(101, 'DragonMaid-OP1')] });
  const dragonMaidS = anime(11, { anilistId: 107717, themes: [theme(111, 'DragonMaidS-OP1')] });
  const special = 98580; // an AniList entry with no audio, so it is not in the catalog
  const data = assembleCatalog(
    inputs(
      [dragonMaid, dragonMaidS],
      [
        media(21776, { relations: [{ type: 'SEQUEL', animeId: special }] }),
        media(107717, { relations: [{ type: 'PREQUEL', animeId: special }] }),
      ],
    ),
  );
  assert.deepEqual(
    data.anime.map((row) => row.franchiseId),
    [10, 10],
  );
});

test('does not join franchises through a crossover special outside the catalog', () => {
  const conan = anime(12, { anilistId: 235, themes: [theme(121, 'Conan-OP1')] });
  const lupin = anime(13, { anilistId: 1412, themes: [theme(131, 'Lupin-OP1')] });
  const crossover = 5904; // "Lupin the 3rd vs. Detective Conan", not in the catalog
  const data = assembleCatalog(
    inputs(
      [conan, lupin],
      [
        media(235, { relations: [{ type: 'SIDE_STORY', animeId: crossover }] }),
        media(1412, { relations: [{ type: 'SIDE_STORY', animeId: crossover }] }),
      ],
    ),
  );
  assert.deepEqual(
    data.anime.map((row) => row.franchiseId),
    [12, 13],
  );
});

test('does not join franchises through CHARACTER relations', () => {
  const crossover = media(20, { relations: [{ type: 'CHARACTER', animeId: 1735 }] });
  const data = assembleCatalog(inputs([naruto, shippuden], [crossover, shippudenMedia]));
  assert.deepEqual(
    data.anime.map((row) => row.franchiseId),
    [1, 2],
  );
});

test('gives the same identity key to the same song under two song ids, and different keys otherwise', () => {
  const artists = [{ id: 9, name: 'Ikimono-gakari', creditedAs: null }];
  const tv = identityKey({ id: 100, title: 'Blue Bird', artists }, 1);
  const movie = identityKey({ id: 200, title: 'Blue  bird!', artists }, 50);
  const cover = identityKey(
    { id: 300, title: 'Blue Bird', artists: [{ id: 8, name: 'Someone Else', creditedAs: null }] },
    1,
  );
  assert.equal(tv, movie);
  assert.notEqual(tv, cover);
  assert.equal(identityKey({ id: 400, title: null, artists }, 1), 'song:400');
});

test('pairs songs without artist credits by title only within one franchise', () => {
  const uncredited = (id: number) => ({ id, title: 'Reason', artists: [] });
  assert.equal(identityKey(uncredited(1), 7), identityKey(uncredited(2), 7));
  assert.notEqual(identityKey(uncredited(1), 7), identityKey(uncredited(3), 8));
});

test('keys a shared song by the franchise of the first anime that uses it', () => {
  const song = { id: 500, title: 'Moonlight Densetsu', artists: [] };
  const first = anime(1, { themes: [theme(11, 'Moon-OP1', { song })] });
  const second = anime(2, { themes: [theme(21, 'MoonR-OP1', { song: { ...song, id: 501 } })] });
  const sequel = media(1001, { relations: [{ type: 'SEQUEL', animeId: 1002 }] });
  const data = assembleCatalog(inputs([first, second], [sequel, media(1002)]));
  assert.deepEqual(
    data.songs.map((row) => row.identityKey),
    ['moonlightdensetsu|franchise:1', 'moonlightdensetsu|franchise:1'],
  );
});

test('ranks popularity from 0 (most popular playable anime) to 1 (least)', () => {
  const data = assembleCatalog(inputs([naruto, shippuden], [narutoMedia, shippudenMedia]));
  assert.deepEqual(
    data.anime.map((row) => [row.id, row.popularityPct]),
    [
      [1, 0],
      [2, 1],
    ],
  );
});

test('rates a popular OP1 easier than an ED3, and an obscure anime harder still', () => {
  const obscure = anime(8, { anilistId: 808, themes: [theme(81, 'Obscure-OP1')] });
  const data = assembleCatalog(inputs([naruto, obscure], [narutoMedia, media(808, { popularity: 10 })]));
  const difficulty = new Map(data.themes.map((row) => [row.id, row.difficulty]));
  assert.deepEqual([difficulty.get(11), difficulty.get(12), difficulty.get(81)], [0, 0.5, 1]);
});

test('fills titles and genres from AniList, and falls back to the AnimeThemes name without it', () => {
  const withoutAniList = anime(9, { anilistId: null, themes: [theme(91, 'Local-OP1')] });
  const data = assembleCatalog({
    ...inputs([naruto, withoutAniList], [narutoMedia]),
    coverFiles: new Map([[20, '20.jpg']]),
  });
  const [first, second] = data.anime;
  assert.deepEqual(
    [first?.titleEnglish, first?.titleNative, first?.genres, first?.coverFile],
    ['English 20', 'Native 20', ['Action'], '20.jpg'],
  );
  assert.deepEqual([second?.titleDisplay, second?.titleEnglish, second?.popularity], ['Anime 9', null, null]);
  assert.equal(data.report.animeWithPopularity, 1);
});

test('builds the same rows from the same inputs', () => {
  const build = () => assembleCatalog(inputs([shippuden, naruto, adult], [narutoMedia, shippudenMedia, adultMedia]));
  assert.deepEqual(build(), build());
});
