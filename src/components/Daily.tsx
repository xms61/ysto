// The daily challenge's surfaces (docs/product-specs/daily.md): today's challenge on the home screen with this
// device's streak, and at the results the day's score, its grid and the line to share.
import { useEffect, useState } from 'react';
import type { LobbyState } from '../../shared/protocol.ts';
import { score } from '../format.ts';
import { badgeOf, currentStreak, dailyGrid, readDaily, recordDaily, shareText } from '../daily/streak.ts';
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

// Today's challenge, when the server offers it: its number, the streak, and the button that starts it.
export function DailyPanel({ storage, onPlay, busy }: { storage: Storage | null; onPlay: () => void; busy: boolean }) {
  const [daily, setDaily] = useState<{ on: boolean; number: number } | null>(null);
  useEffect(() => {
    void fetchDaily().then(setDaily);
  }, []);
  if (!daily?.on) return null;
  const record = readDaily(storage);
  const streak = currentStreak(record, daily.number);
  const played = record.last > 0 && record.last === daily.number;
  return (
    <section aria-labelledby="daily-heading" className="daily-panel">
      <h2 id="daily-heading" className="display text-xl">
        Today&apos;s challenge
      </h2>
      <p className="text-sm text-muted">Daily No. {daily.number} · 10 songs, the same for everyone today</p>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {streakLine(streak, record.best)} <Badge streak={streak} />
      </p>
      <Button variant={played ? 'quiet' : 'primary'} disabled={busy} onClick={onPlay}>
        {played ? 'Play it again for practice' : "Play today's challenge"}
      </Button>
    </section>
  );
}

// At a daily's results: the score, the rounds as a grid, the streak, and the line to share, which names no song.
export function DailyResult({ lobby, storage }: { lobby: LobbyState; storage: Storage | null }) {
  const day = lobby.daily?.number ?? 0;
  const songs = lobby.game?.songs ?? [];
  const mine = lobby.game?.results?.find((result) => result.playerId === lobby.you);
  const gameId = `${lobby.code}:${lobby.tally?.games ?? 0}`;
  const [outcome] = useState<DailyOutcome>(() => recordDaily(storage, day, gameId));
  const [copied, setCopied] = useState(false);
  const grid = dailyGrid(songs, lobby.you);
  const right = mine?.correct ?? 0;
  const text = shareText(day, right, songs.length, score(mine?.score ?? 0), outcome.record.streak, grid);
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
        Daily No. {day} · {right}/{songs.length}
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
