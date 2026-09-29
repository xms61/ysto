// The lobby's players: who is host, who is you, who is away, and for the host a way to remove someone.
import type { LobbyState } from '../../shared/protocol.ts';
import { score } from '../format.ts';

interface PlayerListProps {
  lobby: LobbyState;
  onKick: ((playerId: string) => void) | null; // null unless this player is the host
  showScores: boolean;
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{children}</span>;
}

export function PlayerList({ lobby, onKick, showScores }: PlayerListProps) {
  return (
    <ul aria-label="Players" className="flex flex-col divide-y divide-line">
      {lobby.players.map((player) => (
        <li key={player.id} className="flex items-center gap-2 py-2">
          <span className={`font-medium ${player.connected ? '' : 'text-muted'}`}>{player.name}</span>
          {player.id === lobby.you && <Tag>you</Tag>}
          {player.id === lobby.hostId && <Tag>host</Tag>}
          {!player.connected && <Tag>away</Tag>}
          {player.spectating && <Tag>joins next round</Tag>}
          <span className="ml-auto flex items-center gap-3">
            {showScores && <span className="tabular-nums">{score(player.score)}</span>}
            {onKick && player.id !== lobby.you && (
              <button
                type="button"
                className="text-sm text-muted underline hover:text-bad"
                onClick={() => onKick(player.id)}
              >
                Remove<span className="sr-only"> {player.name}</span>
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
