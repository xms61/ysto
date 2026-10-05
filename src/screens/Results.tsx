// The end of a game (docs/product-specs/game-flow.md): the standings billed like a festival lineup, the
// winner's full name largest, each player's right answers, average time and best streak, and the way to the
// next game. The bill is announced from the bottom up, like a festival's, so the headliner comes last: the
// winner's score counts up, the name drops in, and the theme's material bursts round it. Below, folded away,
// the songs the game played, each with a link to its anime on AnimeThemes.
import type { CSSProperties } from 'react';
import type { LobbyState, PlayedSong, PlayerIcon, ResultView } from '../../shared/protocol.ts';
import { Burst } from '../components/Burst.tsx';
import { PlayerBadge } from '../components/PlayerIcon.tsx';
import { ReactionBar } from '../components/Reactions.tsx';
import { ReportClip } from '../components/ReportClip.tsx';
import { Button, Panel } from '../components/ui.tsx';
import { aired, animeTitle, credits, place, score, seconds, sharedPlaces } from '../format.ts';
import type { TitleLanguages } from '../format.ts';
import { useCountUp, usePagePhase } from '../hooks.ts';
import type { GameStore } from '../realtime/store.ts';
import { useStage } from '../themes/stage.ts';

interface ResultsProps {
  store: GameStore;
  lobby: LobbyState;
  isHost: boolean;
  titles: TitleLanguages;
  reported: number[]; // the rounds whose clip this player reported
}

// Each act waits for the one billed below it; the headliner holds a beat longer.
const ACT_GAP_MS = 260;
const HEADLINER_HOLD_MS = 420;

function nameOf(lobby: LobbyState, playerId: string): string {
  return lobby.players.find((player) => player.id === playerId)?.name ?? 'A player who left';
}

function iconOf(lobby: LobbyState, playerId: string): PlayerIcon | undefined {
  return lobby.players.find((player) => player.id === playerId)?.icon;
}

function statsOf(result: ResultView, rounds: number): string {
  return [
    `${result.correct} of ${rounds} right`,
    result.averageMs !== null && `${seconds(result.averageMs)} on average`,
    result.bestStreak > 0 && `best streak ${result.bestStreak}`,
  ]
    .filter((part) => part !== false)
    .join(' · ');
}

// The winner headlines, second and third are billed below, and everyone else is packed in smaller.
function tierOf(rank: number): string {
  if (rank === 0) return 'bill-lead';
  return rank < 3 ? 'bill-support' : '';
}

function entranceOf(rank: number, count: number): number {
  const fromBottom = count - 1 - rank;
  return fromBottom * ACT_GAP_MS + (rank === 0 ? HEADLINER_HOLD_MS : 0);
}

// The shown number counts; the words a screen reader hears are the final score from the start.
function LeadScore({ value, delayMs }: { value: number; delayMs: number }) {
  const shown = useCountUp(value, delayMs + 200);
  return (
    <span className="bill-score">
      <span aria-hidden="true">{score(shown)}</span>
      <span className="sr-only">{score(value)} points</span>
    </span>
  );
}

// A score as a share of the winner's, for a theme that draws it as a bar. Nothing below zero.
function shareOf(value: number, top: number): number {
  return top > 0 ? Math.max(0, value) / top : 0;
}

function Bill({ lobby, results, rounds }: { lobby: LobbyState; results: ResultView[]; rounds: number }) {
  const places = sharedPlaces(results.map((result) => result.score));
  const { scoreBars } = useStage();
  const top = results[0]?.score ?? 0;
  return (
    <ol aria-label="Final standings" className="bill">
      {results.map((result, rank) => {
        const delayMs = entranceOf(rank, results.length);
        const icon = iconOf(lobby, result.playerId);
        return (
          <li
            key={result.playerId}
            data-player={result.playerId}
            className={`bill-row bill-act ${tierOf(rank)}`}
            style={{ '--act-delay': `${delayMs}ms` } as CSSProperties}
          >
            <span className="bill-place">{place(places[rank] ?? rank + 1)}</span>
            <span className="bill-who">
              <span className="bill-name">
                {icon && <PlayerBadge icon={icon} />}
                {nameOf(lobby, result.playerId)}
              </span>
              {result.playerId === lobby.you && (
                <span className="bill-you ml-2 rounded-lg border px-2 align-middle text-xs">you</span>
              )}
              <span className="bill-stats">{statsOf(result, rounds)}</span>
              {scoreBars && (
                <span
                  aria-hidden="true"
                  className="bill-bar"
                  style={{ '--share': shareOf(result.score, top) } as CSSProperties}
                />
              )}
            </span>
            {rank === 0 ? (
              <LeadScore value={result.score} delayMs={delayMs} />
            ) : (
              <span className="bill-score">
                {score(result.score)}
                <span className="sr-only"> points</span>
              </span>
            )}
            {rank === 0 && <Burst count={30} reach={11} delayMs={delayMs + 380} />}
          </li>
        );
      })}
    </ol>
  );
}

const ANIMETHEMES = 'https://animethemes.moe/anime/';

interface SongListProps {
  store: GameStore;
  songs: PlayedSong[];
  titles: TitleLanguages;
  reported: number[];
}

function SongRow({ song, ...list }: { song: PlayedSong } & Omit<SongListProps, 'songs'>) {
  const { titles } = list;
  const title = animeTitle(song.anime, titles.first);
  const second = titles.second ? animeTitle(song.anime, titles.second) : null;
  const details = [
    `${song.theme.kind} ${song.theme.sequence}`,
    song.song.title,
    song.song.artists.length > 0 && `by ${credits(song.song.artists)}`,
    aired(song.season, song.year),
    song.skipped && 'skipped',
  ].filter((part) => typeof part === 'string');
  return (
    <li className="song-row">
      <span aria-hidden="true" className="song-number">
        {song.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold [overflow-wrap:anywhere]" lang={title.lang}>
          {title.text}
        </span>
        {second && second.text !== title.text && (
          <span className="block text-sm [overflow-wrap:anywhere]" lang={second.lang ?? 'en'}>
            {second.text}
          </span>
        )}
        <span className="block text-sm text-muted">{details.join(' · ')}</span>
        <ReportClip store={list.store} number={song.number} reported={list.reported.includes(song.number)} />
      </span>
      <a className="song-link" href={`${ANIMETHEMES}${encodeURIComponent(song.slug)}`} target="_blank" rel="noreferrer">
        AnimeThemes<span className="sr-only">: {title.text}, opens in a new tab</span>
      </a>
    </li>
  );
}

function SongList({ songs, ...list }: SongListProps) {
  return (
    <details className="adjust song-list">
      <summary className="adjust-summary">Songs this game ({songs.length})</summary>
      <ol aria-label="Songs this game" className="mt-3 flex flex-col">
        {songs.map((song) => (
          <SongRow key={song.number} song={song} {...list} />
        ))}
      </ol>
    </details>
  );
}

// The lead across this lobby's games, once it has played more than one: "Game 3 here. Ann has won 2."
function tallyLine(lobby: LobbyState): string | null {
  const tally = lobby.tally;
  if (!tally || tally.games < 2) return null;
  const most = Math.max(0, ...tally.players.map((line) => line.wins));
  const leaders = tally.players.filter((line) => line.wins === most).map((line) => nameOf(lobby, line.playerId));
  const lead =
    most === 0
      ? 'Nobody has won one yet.'
      : leaders.length === 1
        ? `${leaders[0]} has won ${most}.`
        : `${leaders.join(' and ')} have won ${most} each.`;
  return `Game ${tally.games} in this lobby. ${lead}`;
}

export function Results({ store, lobby, isHost, titles, reported }: ResultsProps) {
  usePagePhase('results');
  const results = lobby.game?.results ?? [];
  const rounds = lobby.game?.rounds ?? 0;
  const songs = lobby.game?.songs ?? [];
  return (
    <Panel className="results flex flex-1 flex-col">
      <h2 className="display mb-4 text-3xl">Final results</h2>
      {tallyLine(lobby) && <p className="-mt-2 mb-4 text-sm text-muted">{tallyLine(lobby)}</p>}
      {rounds === 0 ? (
        <p>No round could be played, because none of the clips loaded. Try another game.</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center pb-6">
          <Bill lobby={lobby} results={results} rounds={rounds} />
        </div>
      )}
      <ReactionBar store={store} />
      {songs.length > 0 && <SongList store={store} songs={songs} titles={titles} reported={reported} />}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {isHost ? (
          <Button onClick={() => store.startGame()}>Play again</Button>
        ) : (
          <p className="text-muted">Waiting for the host to start the next game.</p>
        )}
        <Button variant="quiet" onClick={() => store.closeResults()}>
          {isHost ? 'Change the settings' : 'Back to the lobby'}
        </Button>
      </div>
    </Panel>
  );
}
