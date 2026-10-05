// The games this device finished and the anime heard in them (docs/product-specs/game-log.md): each game with
// its date, the player's place and score, and its songs; or every anime with how often it played and how
// often the player got it, with a link to look it up on AnimeThemes.
import { useState } from 'react';
import { AnimeName } from '../components/AnimeName.tsx';
import { Button, ConfirmButton, Panel } from '../components/ui.tsx';
import { animeThemesUrl, animeTitle, place, score } from '../format.ts';
import type { TitleLanguages } from '../format.ts';
import { animeLog, clearHistory, readHistory } from '../history/history.ts';
import type { LoggedAnime, LoggedGame } from '../history/history.ts';

interface GameLogProps {
  storage: Storage | null;
  titles: TitleLanguages;
  onBack: () => void;
}

type View = 'games' | 'anime';

const WHEN = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

function times(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
}

function summaryOf(game: LoggedGame): string {
  const right = game.songs.filter((song) => song.right).length;
  const standing = game.players === 1 ? 'Solo' : `${place(game.place)} of ${game.players}`;
  return `${standing} · ${score(game.score)} points · ${right} of ${game.songs.length} right`;
}

function AnimeThemesLink({ slug, name }: { slug: string; name: string }) {
  return (
    <a className="song-link" href={animeThemesUrl(slug)} target="_blank" rel="noreferrer">
      AnimeThemes<span className="sr-only">: {name}, opens in a new tab</span>
    </a>
  );
}

function GameRow({ game, titles }: { game: LoggedGame; titles: TitleLanguages }) {
  return (
    <li className="log-game">
      <time className="block text-sm text-muted" dateTime={new Date(game.at).toISOString()}>
        {WHEN.format(game.at)}
      </time>
      <span className="block font-semibold">{summaryOf(game)}</span>
      <details className="log-songs">
        <summary className="adjust-summary">Songs ({game.songs.length})</summary>
        <ol className="mt-2 flex flex-col">
          {game.songs.map((song, index) => (
            <li key={index} className="song-row">
              <span aria-hidden="true" className="song-number">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <AnimeName anime={song.anime} titles={titles} />
                <span className="block text-sm text-muted">
                  {[`${song.kind} ${song.sequence}`, song.title].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="log-mark" data-right={song.right}>
                {song.right ? 'Right' : 'Missed'}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

function AnimeRow({ entry, titles }: { entry: LoggedAnime; titles: TitleLanguages }) {
  const name = animeTitle(entry.anime, titles.first).text;
  return (
    <li className="song-row">
      <span className="min-w-0 flex-1">
        <AnimeName anime={entry.anime} titles={titles} />
        <span className="block text-sm text-muted">
          Heard {times(entry.heard)}, right {entry.right === 0 ? 'never' : times(entry.right)}
        </span>
      </span>
      <AnimeThemesLink slug={entry.slug} name={name} />
    </li>
  );
}

export function GameLog({ storage, titles, onBack }: GameLogProps) {
  const [history, setHistory] = useState(() => readHistory(storage));
  const [view, setView] = useState<View>('games');
  const anime = animeLog(history);
  const tab = (value: View, label: string) => (
    <Button variant={view === value ? 'primary' : 'quiet'} aria-pressed={view === value} onClick={() => setView(value)}>
      {label}
    </Button>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
        <h1 className="display text-3xl">Your games</h1>
      </header>
      {history.length === 0 ? (
        <Panel>
          <p>Games you finish on this device show up here, with every anime you heard in them.</p>
        </Panel>
      ) : (
        <>
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {tab('games', `Games (${history.length})`)}
            {tab('anime', `Anime log (${anime.length})`)}
          </div>
          <Panel>
            {view === 'games' ? (
              <ol aria-label="Games" className="flex flex-col">
                {history.map((game) => (
                  <GameRow key={`${game.id}-${game.at}`} game={game} titles={titles} />
                ))}
              </ol>
            ) : (
              <ol aria-label="Anime log" className="log-anime flex flex-col">
                {anime.map((entry) => (
                  <AnimeRow key={entry.slug} entry={entry} titles={titles} />
                ))}
              </ol>
            )}
          </Panel>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <p>Kept on this device only, the last 100 games.</p>
            <ConfirmButton
              label="Clear the log"
              question="Clear every game from this device?"
              onConfirm={() => {
                clearHistory(storage);
                setHistory([]);
              }}
            />
          </div>
        </>
      )}
    </main>
  );
}
