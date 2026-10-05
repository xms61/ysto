import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_TIMING } from '../../server/game/engine.ts';
import type { ServerMessage } from '../../shared/protocol.ts';
import { createLobby, joinLobby, startServer, TestClient } from '../server/harness.ts';
import type { Seat, ServerOptions, TestServer } from '../server/harness.ts';

type Message<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

async function withServer(run: (server: TestServer) => Promise<void>, options: ServerOptions = {}): Promise<void> {
  const server = await startServer(options);
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

async function nextOf<T extends ServerMessage['type']>(client: TestClient, type: T): Promise<Message<T>> {
  // The type check above picks exactly this message type.
  return (await client.next((message) => message.type === type)) as Message<T>;
}

// A lobby of Ann (host) and Ben, both connected, set to short games.
async function twoPlayerLobby(server: TestServer) {
  const ann = await createLobby(server, 'Ann');
  const annClient = await TestClient.seated(server, ann);
  const ben = await joinLobby(server, ann.code, 'Ben');
  const benClient = await TestClient.seated(server, ben);
  const lobby = server.registry.lobby(ann.code) ?? assert.fail();
  annClient.send({ type: 'settings:update', settings: { ...lobby.settings, songsPerGame: 5, sampleLengthSec: 10 } });
  await benClient.state((state) => state.settings.songsPerGame === 5);
  return { ann, ben, annClient, benClient };
}

async function fetchClip(server: TestServer, seat: Seat, clipToken: string): Promise<Response> {
  return fetch(`${server.baseUrl}/api/clips/${clipToken}`, {
    headers: { authorization: `Bearer ${seat.sessionToken}` },
  });
}

test('plays a whole game over the sockets, from the host start to the results', async () => {
  await withServer(async (server) => {
    const { ann, ben, annClient, benClient } = await twoPlayerLobby(server);
    benClient.send({ type: 'game:start' });
    assert.deepEqual(await nextOf(benClient, 'error'), { type: 'error', code: 'not-host' });
    annClient.send({ type: 'game:start' });
    const playing = await benClient.state((state) => state.game?.phase === 'playing');
    assert.deepEqual(playing.game, { phase: 'playing', number: 0, rounds: 5, results: null, songs: null });
    for (let round = 1; round <= 5; round++) {
      const prepare = await nextOf(annClient, 'round:prepare');
      assert.equal((await nextOf(benClient, 'round:prepare')).clipToken, prepare.clipToken);
      assert.deepEqual([prepare.number, prepare.rounds], [round, 5]);
      const clip = await fetchClip(server, ben, prepare.clipToken);
      assert.equal(clip.status, 200);
      assert.match(await clip.text(), /^clip of /);
      for (const client of [annClient, benClient])
        client.send({ type: 'round:ready', roundId: prepare.roundId, loaded: true });
      const start = await nextOf(annClient, 'round:start');
      assert.equal(start.roundId, prepare.roundId);
      assert.equal(start.options.english.length, 4);
      server.scheduler.advance(start.startsAt - server.scheduler.now() + 1500);
      annClient.send({ type: 'answer', roundId: start.roundId, option: 0 });
      assert.deepEqual((await nextOf(benClient, 'round:answered')).playerIds, [ann.playerId]);
      benClient.send({ type: 'answer', roundId: start.roundId, option: 1 });
      const reveal = await nextOf(benClient, 'round:reveal');
      assert.equal(reveal.roundId, start.roundId);
      assert.deepEqual(
        reveal.picks.map((pick) => [pick.playerId, pick.option]),
        [
          [ann.playerId, 0],
          [ben.playerId, 1],
        ],
      );
      assert.equal(reveal.song.title?.startsWith('Song '), true);
      await nextOf(annClient, 'round:reveal');
      server.scheduler.advance(GAME_TIMING.revealMs);
    }
    const results = await nextOf(annClient, 'game:results');
    assert.deepEqual(
      results.standings.map((standing) => standing.playerId).sort(),
      [ann.playerId, ben.playerId].sort(),
    );
    const over = await benClient.state((state) => state.game?.phase === 'results');
    assert.deepEqual(
      over.players.map((player) => player.score).sort(),
      results.standings.map((standing) => standing.score).sort(),
    );
    assert.deepEqual(over.game?.results, results.standings, 'the lobby state carries the results for reconnects');
    const top = Math.max(...results.standings.map((standing) => standing.score));
    assert.deepEqual(over.tally, {
      games: 1,
      players: over.players.map((player) => {
        const points = results.standings.find((standing) => standing.playerId === player.id)?.score ?? 0;
        return { playerId: player.id, wins: points === top && top > 0 ? 1 : 0, points };
      }),
    });
    benClient.send({ type: 'lobby:leave' });
    const without = await annClient.state((state) => state.players.length === 1);
    assert.deepEqual(
      without.tally?.players.map((line) => line.playerId),
      [ann.playerId],
      'a player who leaves takes their line',
    );
  });
});

test('with answer changes on, sends a switch to the others and runs the overtime before the reveal', async () => {
  await withServer(async (server) => {
    const { ann, ben, annClient, benClient } = await twoPlayerLobby(server);
    const lobby = server.registry.lobby(ann.code) ?? assert.fail();
    annClient.send({ type: 'settings:update', settings: { ...lobby.settings, answerChanges: true, overtimeSec: 3 } });
    await benClient.state((state) => state.settings.answerChanges);
    annClient.send({ type: 'game:start' });
    const prepare = await nextOf(annClient, 'round:prepare');
    for (const client of [annClient, benClient])
      client.send({ type: 'round:ready', roundId: prepare.roundId, loaded: true });
    const start = await nextOf(annClient, 'round:start');
    server.scheduler.advance(start.startsAt - server.scheduler.now() + 1000);
    annClient.send({ type: 'answer', roundId: start.roundId, option: 0 });
    await nextOf(benClient, 'round:answered');
    annClient.send({ type: 'answer', roundId: start.roundId, option: 2 });
    assert.deepEqual(await nextOf(benClient, 'round:switched'), {
      type: 'round:switched',
      roundId: start.roundId,
      playerId: ann.playerId,
    });
    benClient.send({ type: 'answer', roundId: start.roundId, option: 1 });
    const overtime = await nextOf(annClient, 'round:overtime');
    assert.equal(overtime.endsAt - overtime.startsAt, 3000);
    server.scheduler.advance(overtime.endsAt - server.scheduler.now() + GAME_TIMING.graceMs);
    const reveal = await nextOf(benClient, 'round:reveal');
    assert.deepEqual(
      reveal.picks.map((pick) => [pick.playerId, pick.option]),
      [
        [ann.playerId, 2],
        [ben.playerId, 1],
      ],
    );
  });
});

test('keeps one report per player for each revealed clip, and none for a round not yet revealed', async () => {
  await withServer(async (server) => {
    const { annClient, benClient } = await twoPlayerLobby(server);
    annClient.send({ type: 'game:start' });
    const prepare = await nextOf(annClient, 'round:prepare');
    for (const client of [annClient, benClient])
      client.send({ type: 'round:ready', roundId: prepare.roundId, loaded: true });
    const start = await nextOf(annClient, 'round:start');
    server.scheduler.advance(start.startsAt - server.scheduler.now() + 1000);
    annClient.send({ type: 'clip:report', number: 1, reason: 'silent' });
    for (const client of [annClient, benClient]) client.send({ type: 'answer', roundId: start.roundId, option: 0 });
    await nextOf(annClient, 'round:reveal');
    annClient.send({ type: 'clip:report', number: 1, reason: 'bad-cut' });
    annClient.send({ type: 'clip:report', number: 1, reason: 'other' });
    annClient.send({ type: 'clip:report', number: 2, reason: 'silent' });
    benClient.send({ type: 'clip:report', number: 1, reason: 'wrong-song' });
    for (const client of [annClient, benClient]) {
      client.send({ type: 'time:ping', clientTime: 1 });
      await nextOf(client, 'time:pong');
    }
    assert.deepEqual(
      server.reports.map((report) => report.reason),
      ['bad-cut', 'wrong-song'],
    );
    assert.ok(server.reports.every((report) => report.themeId > 0 && report.startMs >= 0));
  });
});

test('refuses settings changes and a second start while a game runs, and lets a late joiner watch first', async () => {
  await withServer(async (server) => {
    const { ann, annClient, benClient } = await twoPlayerLobby(server);
    annClient.send({ type: 'game:start' });
    const prepare = await nextOf(annClient, 'round:prepare');
    annClient.send({ type: 'game:start' });
    assert.deepEqual(await nextOf(annClient, 'error'), { type: 'error', code: 'game-running' });
    const { settings } = server.registry.lobby(ann.code) ?? assert.fail();
    annClient.send({ type: 'settings:update', settings: { ...settings, songsPerGame: 6 } });
    assert.deepEqual(await nextOf(annClient, 'error'), { type: 'error', code: 'game-running' });
    const cid = await joinLobby(server, ann.code, 'Cid');
    const cidClient = await TestClient.open(server);
    cidClient.send({ type: 'hello', sessionToken: cid.sessionToken });
    assert.equal((await nextOf(cidClient, 'round:prepare')).roundId, prepare.roundId);
    const watching = await cidClient.state((state) => state.players.some((player) => player.id === cid.playerId));
    assert.equal(watching.players.find((player) => player.id === cid.playerId)?.spectating, true);
    for (const client of [annClient, benClient])
      client.send({ type: 'round:ready', roundId: prepare.roundId, loaded: true });
    await nextOf(cidClient, 'round:start');
    annClient.send({ type: 'round:skip' });
    assert.equal((await nextOf(cidClient, 'round:reveal')).skipped, true);
    server.scheduler.advance(GAME_TIMING.revealMs);
    await nextOf(cidClient, 'round:prepare');
    const playing = await cidClient.state((state) => state.game?.number === 2);
    assert.equal(playing.players.find((player) => player.id === cid.playerId)?.spectating, false);
  });
});

test('refuses to start a game the pool cannot fill, or past the cap on running games', async () => {
  await withServer(async (server) => {
    const host = await createLobby(server, 'Ann');
    const client = await TestClient.seated(server, host);
    const { settings, code } = server.registry.lobby(host.code) ?? assert.fail();
    // Custom ranks 1–20 hold exactly 20 anime, too few for 50 songs.
    const narrow = {
      ...settings,
      songsPerGame: 50,
      difficulty: 'custom' as const,
      popularityRanks: { from: 1, to: 20 },
    };
    client.send({ type: 'settings:update', settings: narrow });
    await client.state((state) => state.pool.anime === 20);
    client.send({ type: 'game:start' });
    assert.deepEqual(await nextOf(client, 'error'), { type: 'error', code: 'pool-too-small' });
    client.send({ type: 'settings:update', settings: { ...settings, songsPerGame: 5 } });
    await client.state((state) => state.settings.songsPerGame === 5);
    for (const name of ['Ben', 'Cid']) {
      const other = await createLobby(server, name);
      const otherClient = await TestClient.seated(server, other);
      otherClient.send({ type: 'game:start' });
      await nextOf(otherClient, 'round:prepare');
    }
    client.send({ type: 'game:start' });
    assert.deepEqual(await nextOf(client, 'error'), { type: 'error', code: 'server-busy' });
    assert.equal(server.games.running(code), false);
  });
});

test('ends a game whose clips all fail with empty results', async () => {
  const cut = async () => {
    throw new Error('ffmpeg exited with code 1');
  };
  await withServer(
    async (server) => {
      const host = await createLobby(server, 'Ann');
      const client = await TestClient.seated(server, host);
      client.send({ type: 'game:start' });
      const results = await nextOf(client, 'game:results');
      assert.deepEqual(results.standings, []);
      const over = await client.state((state) => state.game?.phase === 'results');
      assert.deepEqual(over.game, { phase: 'results', number: 0, rounds: 0, results: [], songs: [] });
    },
    { cut },
  );
});
