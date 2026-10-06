// npm run reports: lists the players' clip reports (docs/DEPLOY.md), most reported clip first, named from the
// catalog. Reads YSTO_STATE_DIR's reports.sqlite and the catalog; writes nothing.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { REPORT_REASONS } from '../../shared/protocol.ts';
import { isOneOf } from '../../shared/validate.ts';
import { loadConfig } from '../../server/config.ts';
import { REPORTS_FILE } from '../../server/reports.ts';
import { runOrExit } from '../catalog/cli.ts';
import { summarize } from './summary.ts';
import type { ReportRow, ThemeInfo } from './summary.ts';

const THEME = `SELECT a.title_display AS anime, t.slug, f.rel_path FROM theme t JOIN anime a ON a.id = t.anime_id
  LEFT JOIN audio_file f ON f.theme_id = t.id AND f.is_primary = 1 WHERE t.id = ?`;

function readReports(file: string): ReportRow[] {
  if (!existsSync(file)) return [];
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db
      .prepare('SELECT theme_id, start_ms, reason FROM report')
      .all()
      .flatMap((row) =>
        isOneOf(row.reason, REPORT_REASONS)
          ? [{ themeId: Number(row.theme_id), startMs: Number(row.start_ms), reason: row.reason }]
          : [],
      );
  } finally {
    db.close();
  }
}

runOrExit(async () => {
  const config = loadConfig();
  if (config.stateDir === null) throw new Error('Set YSTO_STATE_DIR to the folder the server keeps reports in.');
  const rows = readReports(join(config.stateDir, REPORTS_FILE));
  const catalogFile = join(config.catalogDir, 'catalog.sqlite');
  const catalog = existsSync(catalogFile) ? new DatabaseSync(catalogFile, { readOnly: true }) : null;
  const theme = catalog?.prepare(THEME);
  const themeOf = (themeId: number): ThemeInfo | null => {
    const row = theme?.get(themeId);
    if (!row) return null;
    return { anime: String(row.anime), slug: String(row.slug), relPath: row.rel_path ? String(row.rel_path) : null };
  };
  for (const line of summarize(rows, themeOf)) console.log(line);
  catalog?.close();
});
