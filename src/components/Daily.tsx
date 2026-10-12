// The daily challenges' surfaces (docs/product-specs/daily.md): today's three dailies on the home screen, each with
// this device's streak, and at the results the daily's score, its grid and the line to share.
import { useEffect, useState } from 'react';
import { DAILY_MODES } from '../../shared/daily.ts';
import type { DailyMode } from '../../shared/daily.ts';
import type { LobbyState } from '../../shared/protocol.ts';
import { score } from '../format.ts';
import {
  DAILY_LABELS,
  DAILY_SONGS,
  badgeOf,
  currentStreak,
  dailyGrid,
  readDaily,
  recordDaily,
  shareText,
} from '../daily/streak.ts';
import type { DailyOutcome } from '../daily/streak.ts';
import { fetchDaily } from '../realtime/api.ts';
import { Button } from './ui.tsx';

function streakLine(streak: number, best: number): string {
  if (streak === 0) return best > 0 ? `Best run: ${best} days` : 'Play today to start a streak.';
  const days = streak === 1 ? '1 day' : `${streak} days`;
  return best > streak ? `${days} in a row · best ${best}` : `${days} in a row`;
}

function Badge({ streak }: { streak: number }) {
  const badge = badgeOf(streak);
  return badge === null ? null : <span className="daily-badge">{badge}-day streak</span>;
}

interface DailyRowProps {
  mode: DailyMode;
  day: number;
  storage: Storage | null;
  busy: boolean;
  onPlay: (mode: DailyMode) => void;
}

// One daily on the home screen: what it plays, its streak, and its button, which offers practice once it is played.
function DailyRow({ mode, day, storage, busy, onPlay }: DailyRowProps) {
  const record = readDaily(storage, mode);
  const streak = currentStreak(record, day);
  const played = record.last > 0 && record.last === day;
  const label = DAILY_LABELS[mode];
  return (
    <li className="daily-row">
      <div className="flex flex-col gap-1">
        <h3 className="display text-lg">{label}</h3>
        <p className="text-sm text-muted">{DAILY_SONGS[mode]}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {streakLine(streak, record.best)} <Badge streak={streak} />
        </p>
      </div>
      <Button
        variant={played ? 'quiet' : 'primary'}
        disabled={busy}
        aria-label={played ? `Practice ${label}` : `Play ${label}`}
        onClick={() => onPlay(mode)}
      >
        {played ? 'Practice' : 'Play'}
      </Button>
    </li>
  );
}

interface DailyPanelProps {
  storage: Storage | null;
  onPlay: (mode: DailyMode) => void;
  busy: boolean;
}

// Today's dailies, when the server offers them: the day's number, and a row for each daily.
export function DailyPanel({ storage, onPlay, busy }: DailyPanelProps) {
  const [daily, setDaily] = useState<{ on: boolean; number: number } | null>(null);
  useEffect(() => {
    void fetchDaily().then(setDaily);
  }, []);
  if (!daily?.on) return null;
  return (
    <section aria-labelledby="daily-heading" className="daily-panel">
      <h2 id="daily-heading" className="display text-xl">
        Today&apos;s challenges
      </h2>
      <p className="text-sm text-muted">Daily No. {daily.number} · the same songs for everyone today</p>
      <ul className="daily-rows">
        {DAILY_MODES.map((mode) => (
          <DailyRow key={mode} mode={mode} day={daily.number} storage={storage} busy={busy} onPlay={onPlay} />
        ))}
      </ul>
    </section>
  );
}

// At a daily's results: the score, the rounds as a grid, the daily's streak, and the line to share, which names no
// song.
export function DailyResult({ lobby, storage }: { lobby: LobbyState; storage: Storage | null }) {
  const day = lobby.daily?.number ?? 0;
  const mode = lobby.daily?.mode ?? 'both';
  const songs = lobby.game?.songs ?? [];
  const mine = lobby.game?.results?.find((result) => result.playerId === lobby.you);
  const gameId = `${lobby.code}:${lobby.tally?.games ?? 0}`;
  const [outcome] = useState<DailyOutcome>(() => recordDaily(storage, mode, day, gameId));
  const [copied, setCopied] = useState(false);
  const grid = dailyGrid(songs, lobby.you);
  const right = mine?.correct ?? 0;
  const text = shareText({
    day,
    mode,
    right,
    rounds: songs.length,
    score: score(mine?.score ?? 0),
    streak: outcome.record.streak,
    grid,
  });
  const share = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section aria-label="Today's result" className="daily-result">
      <p className="display text-2xl">
        Daily No. {day} · {DAILY_LABELS[mode]} · {right}/{songs.length}
        {outcome.practice && <span className="ml-2 text-sm text-muted">practice</span>}
      </p>
      <p aria-hidden="true" className="daily-grid">
        {grid}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {streakLine(outcome.record.streak, outcome.record.best)} <Badge streak={outcome.record.streak} />
      </p>
      <Button variant="quiet" className="self-start" onClick={() => void share()}>
        {copied ? 'Copied' : 'Copy the result to share'}
      </Button>
    </section>
  );
}
