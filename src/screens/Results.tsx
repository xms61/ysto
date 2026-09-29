// The end of a game: the podium, each player's right answers, average time and best streak, and the way
// to the next game (docs/product-specs/game-flow.md).
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

function Podium({ lobby, results }: { lobby: LobbyState; results: ResultView[] }) {
  return (
    <ol aria-label="Podium" className="mb-6 grid grid-cols-3 items-end gap-2 text-center">
      {results.slice(0, 3).map((result, index) => (
        <li
          key={result.playerId}
          className={`rounded-xl border bg-raised p-3 ${index === 0 ? 'border-accent pb-6' : 'border-line'}`}
        >
          <span className="display block text-lg text-muted">{place(index + 1)}</span>
          <span className="block truncate font-bold">{nameOf(lobby, result.playerId)}</span>
          <span className="block tabular-nums">{score(result.score)}</span>
        </li>
      ))}
    </ol>
  );
}

const HEADERS = ['Player', 'Score', 'Right', 'Avg time', 'Streak'];

function Table({ lobby, results, rounds }: { lobby: LobbyState; results: ResultView[]; rounds: number }) {
  return (
    <table className="w-full text-left">
      <caption className="sr-only">
        Final results: each player&apos;s place, score, right answers out of {rounds}, average time of right answers,
        and best streak
      </caption>
      <thead className="text-sm text-muted">
        <tr>
          {HEADERS.map((header, index) => (
            <th key={header} scope="col" className={`py-1 font-medium ${index === 0 ? 'pr-2' : 'px-1 text-right'}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {results.map((result, index) => (
          <tr key={result.playerId} className="border-t border-line">
            <td className="py-2 pr-2">
              <span className="mr-2 text-sm text-muted">{place(index + 1)}</span>
              {nameOf(lobby, result.playerId)}
            </td>
            <td className="px-1 py-2 text-right">{score(result.score)}</td>
            <td className="px-1 py-2 text-right">
              {result.correct}/{rounds}
            </td>
            <td className="px-1 py-2 text-right">{result.averageMs === null ? 'none' : seconds(result.averageMs)}</td>
            <td className="py-2 pl-1 text-right">{result.bestStreak}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
          <>
            <Podium lobby={lobby} results={results} />
            <div className="overflow-x-auto">
              <Table lobby={lobby} results={results} rounds={rounds} />
            </div>
          </>
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
