import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createLogger } from '../../server/log.ts';
import { openReports, openReportsDb } from '../../server/reports.ts';

const REPORT = { at: 1000, themeId: 42, startMs: 31_500, reason: 'bad-cut' } as const;

function capture() {
  const lines: string[] = [];
  return { lines, log: createLogger('info', (line) => lines.push(line)) };
}

test('keeps reports in the state folder, across a reopen, and logs each one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ysto-reports-'));
  try {
    const { lines, log } = capture();
    for (const report of [REPORT, { ...REPORT, at: 2000, reason: 'silent' } as const]) {
      const reports = openReports(dir, log);
      reports.add(report);
      reports.close();
    }
    const db = openReportsDb(dir);
    const rows = db.prepare('SELECT at, theme_id, start_ms, reason FROM report ORDER BY at').all();
    db.close();
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [
        { at: 1000, theme_id: 42, start_ms: 31_500, reason: 'bad-cut' },
        { at: 2000, theme_id: 42, start_ms: 31_500, reason: 'silent' },
      ],
    );
    assert.equal(lines.filter((line) => line.includes('clip.reported')).length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('only logs reports without a state folder', () => {
  const { lines, log } = capture();
  openReports(null, log).add(REPORT);
  assert.match(lines.join(), /clip\.reported.*"themeId":42/);
});
