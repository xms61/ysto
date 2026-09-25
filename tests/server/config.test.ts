import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../server/config.ts';

test('defaults the port to 3000', () => {
  assert.equal(loadConfig({}).port, 3000);
  assert.equal(loadConfig({ PORT: '' }).port, 3000);
});

test('reads PORT', () => {
  assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
});

test('rejects a PORT that is not a port number', () => {
  for (const value of ['0', '65536', 'abc', '3000.5']) {
    assert.throws(() => loadConfig({ PORT: value }), {
      message: `PORT must be an integer from 1 to 65535, got "${value}"`,
    });
  }
});
