// Reactions (docs/product-specs/lobby.md): the bar of six on the reveal, the results and in the lobby, and
// the layer where each one rises from its sender's name on screen, or from a corner, named, when the name
// isn't showing. Screen readers hear who reacted with what.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { REACTION_KINDS } from '../../shared/protocol.ts';
import type { LobbyState, ReactionKind } from '../../shared/protocol.ts';
import type { GameStore, Reaction } from '../realtime/store.ts';
import { REACTION_LABELS, ReactionIcon } from './ReactionIcon.tsx';

const SHOWN_MS = 2400;

export function ReactionBar({ store }: { store: GameStore }) {
  return (
    <div role="group" aria-label="React" className="reaction-bar">
      {REACTION_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          className="reaction-button"
          aria-label={REACTION_LABELS[kind]}
          title={REACTION_LABELS[kind]}
          onClick={() => store.react(kind)}
        >
          <ReactionIcon kind={kind} />
        </button>
      ))}
    </div>
  );
}

interface Floating {
  id: number;
  playerId: string;
  kind: ReactionKind;
  at: { x: number; y: number } | null; // over the sender's name, or null for the corner
}

// The first element on screen that names the player: a seat in the player list, a row of the scoreboard or
// the bill, or a picker under a card.
function placeOf(playerId: string): { x: number; y: number } | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-player="${CSS.escape(playerId)}"]`)) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.bottom > 0 && box.top < window.innerHeight) {
      return { x: box.left + Math.min(box.width - 20, 150), y: box.top + box.height / 2 };
    }
  }
  return null;
}

export function ReactionLayer({ store, lobby }: { store: GameStore; lobby: LobbyState }) {
  const [floating, setFloating] = useState<Floating[]>([]);
  const counter = useRef(0);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = store.onReaction(({ playerId, kind }: Reaction) => {
      const id = ++counter.current;
      setFloating((current) => [...current, { id, playerId, kind, at: placeOf(playerId) }]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setFloating((current) => current.filter((item) => item.id !== id));
      }, SHOWN_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [store]);
  const nameOf = (playerId: string) => lobby.players.find((player) => player.id === playerId)?.name ?? 'Someone';
  const latest = floating.at(-1);
  return createPortal(
    <>
      <p aria-live="polite" className="sr-only">
        {latest && `${nameOf(latest.playerId)}: ${REACTION_LABELS[latest.kind]}`}
      </p>
      <div aria-hidden="true" className="reaction-layer">
        {floating.map((item) =>
          item.at ? (
            <span
              key={item.id}
              className="reaction-float"
              style={{ left: `${item.at.x}px`, top: `${item.at.y}px` } as CSSProperties}
            >
              <ReactionIcon kind={item.kind} />
            </span>
          ) : null,
        )}
        <div className="reaction-corner">
          {floating
            .filter((item) => !item.at)
            .map((item) => (
              <span key={item.id} className="reaction-float reaction-named">
                <ReactionIcon kind={item.kind} />
                {nameOf(item.playerId)}
              </span>
            ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
