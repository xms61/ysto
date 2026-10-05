// Players' reports of broken clips (docs/product-specs/game-flow.md), kept in reports.sqlite in the state
// folder for the owner to read with npm run reports. A report holds the theme, the clip's start and the
// reason: no names, addresses or lobby codes (docs/SECURITY.md). Without a state folder, or with one the
// server can't write (a VPS whose compose file predates the state volume), reports are only logged and the
// game runs on. A failed write is logged and never reaches the player.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ReportReason } from '../shared/protocol.ts';
import type { Logger } from './log.ts';

export interface ClipReport {
  at: number;
  themeId: number;
  startMs: number;
  reason: ReportReason;
}

export interface Reports {
  add(report: ClipReport): void;
  close(): void;
}

export const REPORTS_FILE = 'reports.sqlite';

const SCHEMA = `CREATE TABLE IF NOT EXISTS report (
  id       INTEGER PRIMARY KEY,
  at       INTEGER NOT NULL,              -- ms since the epoch
  theme_id INTEGER NOT NULL,              -- the catalog's theme id
  start_ms INTEGER NOT NULL,              -- where the clip started in the song
  reason   TEXT NOT NULL                  -- silent, wrong-song, bad-cut or other
)`;

export function openReportsDb(stateDir: string): DatabaseSync {
  mkdirSync(stateDir, { recursive: true });
  const db = new DatabaseSync(join(stateDir, REPORTS_FILE));
  db.exec(SCHEMA);
  return db;
}

function openOrLog(stateDir: string | null, log: Logger): DatabaseSync | null {
  if (stateDir === null) return null;
  try {
    return openReportsDb(stateDir);
  } catch (error) {
    log.error('reports.unavailable', {
      message: `${error instanceof Error ? error.message : String(error)}; reports are only logged`,
    });
    return null;
  }
}

export function openReports(stateDir: string | null, log: Logger): Reports {
  const db = openOrLog(stateDir, log);
  const insert = db?.prepare('INSERT INTO report (at, theme_id, start_ms, reason) VALUES (?, ?, ?, ?)');
  return {
    add(report) {
      log.info('clip.reported', { themeId: report.themeId, startMs: report.startMs, reason: report.reason });
      try {
        insert?.run(report.at, report.themeId, report.startMs, report.reason);
      } catch (error) {
        log.error('clip.report-failed', { message: error instanceof Error ? error.message : String(error) });
      }
    },
    close() {
      db?.close();
    },
  };
}
