// The end of a game (docs/product-specs/game-flow.md): the standings billed like a festival lineup, the
// winner's full name largest, each player's right answers, average time and best streak, and the way to the
// next game. The bill is announced from the bottom up, like a festival's, so the headliner comes last: the
// winner's score counts up, the name drops in, and the theme's material bursts round it.
import type { CSSProperties } from 'react';
import type { LobbyState, ResultView } from '../../shared/protocol.ts';
import { Burst } from '../components/Burst.tsx';
import { Button, Panel } from '../components/ui.tsx';
import { place, score, seconds, sharedPlaces } from '../format.ts';
import { useCountUp, usePagePhase } from '../hooks.ts';
import type { GameStore } from '../realtime/store.ts';

interface ResultsProps {
  store: GameStore;
  lobby: LobbyState;
  isHost: boolean;
}

// Each act waits for the one billed below it; the headliner holds a beat longer.
const ACT_GAP_MS = 260;
const HEADLINER_HOLD_MS = 420;

function nameOf(lobby: LobbyState, playerId: string): string {
  return lobby.players.find((player) => player.id === playerId)?.name ?? 'A player who left';
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

function Bill({ lobby, results, rounds }: { lobby: LobbyState; results: ResultView[]; rounds: number }) {
  const places = sharedPlaces(results.map((result) => result.score));
  return (
    <ol aria-label="Final standings" className="bill">
      {results.map((result, rank) => {
        const delayMs = entranceOf(rank, results.length);
        return (
          <li
            key={result.playerId}
            className={`bill-row bill-act ${tierOf(rank)}`}
            style={{ '--act-delay': `${delayMs}ms` } as CSSProperties}
          >
            <span className="bill-place">{place(places[rank] ?? rank + 1)}</span>
            <span className="bill-who">
              <span className="bill-name">{nameOf(lobby, result.playerId)}</span>
              {result.playerId === lobby.you && (
                <span className="bill-you ml-2 rounded-full border px-2 align-middle text-xs">you</span>
              )}
              <span className="bill-stats">{statsOf(result, rounds)}</span>
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

export function Results({ store, lobby, isHost }: ResultsProps) {
  usePagePhase('results');
  const results = lobby.game?.results ?? [];
  const rounds = lobby.game?.rounds ?? 0;
  return (
    <Panel className="results flex flex-1 flex-col">
      <h2 className="display mb-4 text-3xl">Final results</h2>
      {rounds === 0 ? (
        <p>No round could be played, because none of the clips loaded. Try another game.</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center pb-6">
          <Bill lobby={lobby} results={results} rounds={rounds} />
        </div>
      )}
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
