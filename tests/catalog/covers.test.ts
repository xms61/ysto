import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { coverFileName, downloadCovers, listCoverFiles } from '../../scripts/catalog/covers.ts';
import { fakeHttp } from './fixtures.ts';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-covers-'));
  dirs.push(dir);
  return dir;
}

test('names a cover after the AniList id, keeping a known image extension', () => {
  assert.equal(coverFileName({ anilistId: 20, url: 'https://img.example.test/cover/bx20-abc.png' }), '20.png');
  assert.equal(coverFileName({ anilistId: 21, url: 'https://img.example.test/cover/bx21' }), '21.jpg');
});

test('downloads only covers that are not on disk yet', async () => {
  const coversDir = tempDir();
  writeFileSync(join(coversDir, '1.jpg'), 'old');
  const http = fakeHttp([new Response(new Uint8Array([1, 2, 3]))]);
  const covers = [
    { anilistId: 1, url: 'https://img.example.test/1.jpg' },
    { anilistId: 2, url: 'https://img.example.test/2.jpg' },
  ];
  assert.deepEqual(await downloadCovers({ covers, coversDir, http, concurrency: 2, log: () => {} }), {
    downloaded: 1,
    skipped: 1,
  });
  assert.equal(http.requests.length, 1);
  assert.deepEqual([...readFileSync(join(coversDir, '2.jpg'))], [1, 2, 3]);
  assert.deepEqual(readdirSync(coversDir), ['1.jpg', '2.jpg']);
});

test('maps AniList ids to the cover files on disk, ignoring anything else', () => {
  const coversDir = tempDir();
  for (const name of ['20.jpg', '21.png', 'notes.txt', 'x.jpg']) writeFileSync(join(coversDir, name), '');
  assert.deepEqual(
    [...listCoverFiles(coversDir)],
    [
      [20, '20.jpg'],
      [21, '21.png'],
    ],
  );
  assert.equal(listCoverFiles(join(coversDir, 'missing')).size, 0);
});
