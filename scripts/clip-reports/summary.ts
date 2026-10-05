// The owner's view of the players' clip reports: one line per reported clip, most reported first.
import type { ReportReason } from '../../shared/protocol.ts';

export interface ReportRow {
  themeId: number;
  startMs: number;
  reason: ReportReason;
}

// What the catalog says about a reported theme, or null when the catalog no longer has it.
export interface ThemeInfo {
  anime: string;
  slug: string; // OP1, ED2
  relPath: string | null;
}

const REASON_LABELS: Record<ReportReason, string> = {
  silent: 'silent',
  'wrong-song': 'wrong song',
  'bad-cut': 'bad cut',
  other: 'other',
};

function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function summarize(rows: ReportRow[], themeOf: (themeId: number) => ThemeInfo | null): string[] {
  if (rows.length === 0) return ['No reports.'];
  const byTheme = Map.groupBy(rows, (row) => row.themeId);
  const clips = [...byTheme].sort(([idA, a], [idB, b]) => b.length - a.length || idA - idB);
  const lines = [`${rows.length} reports on ${clips.length} clips, most reported first:`];
  for (const [themeId, reports] of clips) {
    const theme = themeOf(themeId);
    const name = theme ? `${theme.anime} ${theme.slug}` : 'no longer in the catalog';
    const reasons = Map.groupBy(reports, (report) => report.reason);
    const counts = [...reasons].map(([reason, list]) => `${REASON_LABELS[reason]} ${list.length}`).join(', ');
    const starts = [...new Set(reports.map((report) => clock(report.startMs)))].join(', ');
    lines.push(`${reports.length}  theme ${themeId}, ${name}: ${counts}; clips from ${starts}`);
    if (theme?.relPath) lines.push(`   ${theme.relPath}`);
  }
  return lines;
}
