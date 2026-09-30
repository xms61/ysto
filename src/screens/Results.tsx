// The end of a game (docs/product-specs/game-flow.md): the standings billed like a festival lineup, the
// winner's full name largest, each player's right answers, average time and best streak, and the way to the
// next game.
import type { LobbyState, ResultView } from '../../shared/protocol.ts';
import { Button, Panel } from '../components/ui.tsx';
import { place, score, seconds } from '../format.ts';
import type { GameStore } from '../realtime/store.ts';

interface ResultsProps {
  store: GameStore;
  lobby: LobbyState;
  isHost: boolean;
}

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

function Bill({ lobby, results, rounds }: { lobby: LobbyState; results: ResultView[]; rounds: number }) {
  return (
    <ol aria-label="Final standings">
      {results.map((result, rank) => (
        <li key={result.playerId} className={`bill-row ${tierOf(rank)}`}>
          <span className="bill-place">{place(rank + 1)}</span>
          <span className="bill-who">
            <span className="bill-name">{nameOf(lobby, result.playerId)}</span>
            {result.playerId === lobby.you && (
              <span className="ml-2 rounded-full border border-line px-2 align-middle text-xs text-muted">you</span>
            )}
            <span className="bill-stats">{statsOf(result, rounds)}</span>
          </span>
          <span className="bill-score">
            {score(result.score)}
            <span className="sr-only"> points</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Results({ store, lobby, isHost }: ResultsProps) {
  const results = lobby.game?.results ?? [];
  const rounds = lobby.game?.rounds ?? 0;
  return (
    <>
      <Panel>
        <h2 className="display mb-4 text-3xl">Final results</h2>
        {rounds === 0 ? (
          <p>No round could be played, because none of the clips loaded. Try another game.</p>
        ) : (
          <Bill lobby={lobby} results={results} rounds={rounds} />
        )}
      </Panel>
      <div className="flex flex-wrap items-center gap-3">
        {isHost ? (
          <Button onClick={() => store.startGame()}>Play again</Button>
        ) : (
          <p className="text-muted">Waiting for the host to start the next game.</p>
        )}
        <Button variant="quiet" onClick={() => store.closeResults()}>
          {isHost ? 'Change the settings' : 'Back to the lobby'}
        </Button>
      </div>
    </>
  );
}
