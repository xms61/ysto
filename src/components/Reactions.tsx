// Reactions (docs/product-specs/lobby.md): the bar of seven in the lobby, through the round and on the results,
// and the layer where each one appears at a random spot round where it came from and drifts up, swaying, as it
// fades: for the sender, the button they pressed; for everyone else, the sender's name on screen, or a corner,
// named, when the name isn't showing. Screen readers hear who reacted with what.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { REACTION_KINDS } from '../../shared/protocol.ts';
import type { LobbyState, ReactionKind } from '../../shared/protocol.ts';
import type { GameStore, Reaction } from '../realtime/store.ts';
import { REACTION_LABELS, ReactionIcon } from './ReactionIcon.tsx';

const SHOWN_MS = 2400;
const MOST_SHOWN = 40; // a spam of reactions keeps only the newest on screen
const PRESS_KEPT_MS = 2000; // how long a press waits for its own reaction to come back from the server

type Point = { x: number; y: number };

// Where this player last pressed a reaction, so their own comes up there rather than at their name. The bar
// and the layer are apart in the page, so they share it here.
let lastPress: (Point & { kind: ReactionKind; at: number }) | null = null;

function press(store: GameStore, kind: ReactionKind, button: HTMLElement): void {
  const box = button.getBoundingClientRect();
  lastPress = { kind, x: box.left + box.width / 2, y: box.top + box.height / 2, at: Date.now() };
  store.react(kind);
}

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
          onClick={(event) => press(store, kind, event.currentTarget)}
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
  at: Point | null; // where it starts, or null for the corner
  drift: { x: number; rise: number; sway: number; swayMs: number }; // its random path up, in px, and its sway's pace
}

const spread = (range: number) => (Math.random() - 0.5) * 2 * range;

// A random spot round where the reaction came from, and a random path up from it.
function scatter(from: Point | null): Pick<Floating, 'at' | 'drift'> {
  const at = from && { x: from.x + spread(28), y: from.y + spread(16) };
  const sway = (6 + Math.random() * 10) * (Math.random() < 0.5 ? -1 : 1);
  return { at, drift: { x: spread(36), rise: 90 + Math.random() * 70, sway, swayMs: 500 + Math.random() * 400 } };
}

// The sender's own reaction starts at the button they pressed.
function originOf(playerId: string, you: string, kind: ReactionKind): Point | null {
  const pressed = lastPress;
  if (playerId === you && pressed && pressed.kind === kind && Date.now() - pressed.at < PRESS_KEPT_MS) return pressed;
  return placeOf(playerId);
}

// The first element on screen that names the player: a seat in the player list, a row of the scoreboard or
// the bill, or a picker under a card.
function placeOf(playerId: string): Point | null {
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
  const you = lobby.you;
  const counter = useRef(0);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = store.onReaction(({ playerId, kind }: Reaction) => {
      const id = ++counter.current;
      const item = { id, playerId, kind, ...scatter(originOf(playerId, you, kind)) };
      setFloating((current) => [...current, item].slice(-MOST_SHOWN));
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
  }, [store, you]);
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
              style={
                {
                  left: `${item.at.x}px`,
                  top: `${item.at.y}px`,
                  '--drift-x': `${item.drift.x}px`,
                  '--rise': `${item.drift.rise}px`,
                  '--sway': `${item.drift.sway}px`,
                  '--sway-ms': `${item.drift.swayMs}ms`,
                } as CSSProperties
              }
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
