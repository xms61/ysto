import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pick, secureRandom, seededRandom, shuffle } from '../../server/game/random.ts';

test('repeats a seeded sequence for the same seed, and not for another', () => {
  const draws = (seed: number) => {
    const random = seededRandom(seed);
    return Array.from({ length: 8 }, () => random.int(1000));
  };
  assert.deepEqual(draws(42), draws(42));
  assert.notDeepEqual(draws(42), draws(43));
});

test('draws whole numbers below the limit, evenly, from both generators', () => {
  for (const random of [secureRandom, seededRandom(1)]) {
    const counts = [0, 0, 0];
    for (let draw = 0; draw < 3000; draw++) {
      const value = random.int(3);
      assert.ok(Number.isInteger(value) && value >= 0 && value < 3, `drew ${value}`);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    // 1,000 expected each; 800 is more than seven standard deviations away.
    assert.ok(
      counts.every((count) => count > 800),
      `counts ${counts.join('/')}`,
    );
  }
});

test('picks from a list, and refuses an empty one', () => {
  assert.equal(pick(['only'], seededRandom(1)), 'only');
  assert.throws(() => pick([], seededRandom(1)), /Cannot pick from an empty list/);
});

test('shuffles into every order about equally often, without changing the input', () => {
  const items = ['a', 'b', 'c'];
  const random = seededRandom(7);
  const orders = new Map<string, number>();
  for (let round = 0; round < 6000; round++) {
    const order = shuffle(items, random).join('');
    orders.set(order, (orders.get(order) ?? 0) + 1);
  }
  assert.deepEqual(items, ['a', 'b', 'c']);
  assert.equal(orders.size, 6);
  for (const [order, count] of orders) assert.ok(Math.abs(count - 1000) < 150, `${order} came ${count} times`);
});
