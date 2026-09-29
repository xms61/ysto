import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp } from '../../server/client-ip.ts';

test('uses the direct address when no proxy is trusted, whatever the headers say', () => {
  assert.equal(clientIp('198.51.100.7', '203.0.113.1', 0), '198.51.100.7');
  assert.equal(clientIp(undefined, undefined, 0), 'unknown');
});

test('takes the address the trusted proxies saw from the end of X-Forwarded-For', () => {
  // A client may send its own X-Forwarded-For; the proxy appends the address it really saw.
  assert.equal(clientIp('127.0.0.1', 'spoofed, 203.0.113.9', 1), '203.0.113.9');
  assert.equal(clientIp('127.0.0.1', '203.0.113.9, 198.51.100.2', 2), '203.0.113.9');
  assert.equal(clientIp('127.0.0.1', ['203.0.113.9', '198.51.100.2'], 1), '198.51.100.2');
  assert.equal(clientIp('127.0.0.1', '203.0.113.9', 3), '203.0.113.9', 'a chain shorter than the hops');
  assert.equal(clientIp('127.0.0.1', undefined, 1), '127.0.0.1');
});
