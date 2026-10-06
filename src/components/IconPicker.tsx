// The player's animal, chosen in the lobby (docs/product-specs/lobby.md): a fold with the sixteen, each one
// another player has stepped back and named. The server keeps two players from sharing one.
import { PLAYER_ICONS } from '../../shared/protocol.ts';
import type { LobbyState } from '../../shared/protocol.ts';
import type { GameStore } from '../realtime/store.ts';
import { ICON_NAMES, PlayerBadge } from './PlayerIcon.tsx';

export function IconPicker({ store, lobby }: { store: GameStore; lobby: LobbyState }) {
  const mine = lobby.players.find((player) => player.id === lobby.you)?.icon;
  const holderOf = (icon: string) => lobby.players.find((player) => player.id !== lobby.you && player.icon === icon);
  return (
    <details className="adjust mt-3">
      <summary className="adjust-summary">Your animal{mine ? `: ${ICON_NAMES[mine]}` : ''}</summary>
      <div role="group" aria-label="Animals" className="icon-grid">
        {PLAYER_ICONS.map((icon) => {
          const holder = holderOf(icon);
          return (
            <button
              key={icon}
              type="button"
              className="icon-choice"
              aria-pressed={icon === mine}
              aria-label={holder ? `${ICON_NAMES[icon]}, taken by ${holder.name}` : ICON_NAMES[icon]}
              disabled={holder !== undefined}
              onClick={() => store.chooseIcon(icon)}
            >
              <PlayerBadge icon={icon} />
              <span aria-hidden="true">{ICON_NAMES[icon]}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
