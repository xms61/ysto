import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanName, nameKey } from '../../shared/names.ts';

const CASES: [raw: string, cleaned: string | null][] = [
  ['Mikasa', 'Mikasa'],
  ['  Levi  ', 'Levi'],
  ['Ｅｒｅｎ', 'Eren'],
  ['Arm​in', 'Armin'],
  ['‮evil', 'evil'],
  ['Sasha\u0000', 'Sasha'],
  ['Jean   Kirstein', 'Jean Kirstein'],
  ['ヒストリア', 'ヒストリア'],
  ['🍙🍙', '🍙🍙'],
  ['', null],
  ['   ', null],
  ['​‍', null],
  ['a'.repeat(20), 'a'.repeat(20)],
  ['a'.repeat(21), null],
];

for (const [raw, cleaned] of CASES) {
  test(`cleans ${JSON.stringify(raw)} to ${JSON.stringify(cleaned)}`, () => {
    assert.equal(cleanName(raw), cleaned);
  });
}

test('compares names without regard to case', () => {
  assert.equal(nameKey('Mikasa'), nameKey('MIKASA'));
  assert.notEqual(nameKey('Mikasa'), nameKey('Mikasa2'));
});
