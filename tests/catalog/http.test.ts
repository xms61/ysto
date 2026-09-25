import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getJson, postJson, USER_AGENT } from '../../scripts/catalog/http.ts';
import { fakeHttp, jsonResponse } from './fixtures.ts';

const URL = 'https://api.example.test/items';

test('returns the JSON of a successful response, sent with the User-Agent that names the repo', async () => {
  const http = fakeHttp([jsonResponse({ ok: true })]);
  assert.deepEqual(await getJson(http, URL), { ok: true });
  assert.equal(new Headers(http.requests[0]?.init.headers).get('User-Agent'), USER_AGENT);
});

test('waits for Retry-After on a 429, then retries', async () => {
  const http = fakeHttp([jsonResponse({}, 429, { 'retry-after': '3' }), jsonResponse({ ok: true })]);
  assert.deepEqual(await getJson(http, URL), { ok: true });
  assert.deepEqual(http.sleeps, [3000]);
});

test('backs off exponentially on server errors and network failures', async () => {
  const http = fakeHttp([
    jsonResponse({}, 500),
    new Error('socket hang up'),
    jsonResponse({}, 522),
    jsonResponse({ ok: 1 }),
  ]);
  assert.deepEqual(await getJson(http, URL), { ok: 1 });
  assert.deepEqual(http.sleeps, [2000, 4000, 8000]);
});

test('gives up after five attempts', async () => {
  const http = fakeHttp(Array.from({ length: 5 }, () => jsonResponse({}, 503)));
  await assert.rejects(getJson(http, URL), { message: `GET ${URL} failed after 5 attempt(s): HTTP 503` });
  assert.equal(http.requests.length, 5);
});

test('does not retry client errors', async () => {
  const http = fakeHttp([jsonResponse({}, 404)]);
  await assert.rejects(getJson(http, URL), { message: `GET ${URL} failed after 1 attempt(s): HTTP 404` });
});

test('posts JSON', async () => {
  const http = fakeHttp([jsonResponse({ data: 1 })]);
  assert.deepEqual(await postJson(http, URL, { query: 'q' }), { data: 1 });
  const request = http.requests[0];
  assert.equal(request?.init.method, 'POST');
  assert.equal(request?.init.body, '{"query":"q"}');
  assert.equal(new Headers(request?.init.headers).get('Content-Type'), 'application/json');
});
