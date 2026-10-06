// The round's stage: a slot above the cards, the cards, and what follows them. The cards never move from the
// deal to the reveal: the slot lays a hidden copy of the round's countdown and timer (the ghost) under what it
// shows, so it always takes their height, and the cards hang from its foot, so a card that grows (a title that
// wraps, the right card turned over) grows downward. RoundBody puts the stage beside the round's side column
// on a wide screen.
import type { ReactNode } from 'react';

interface StageProps {
  slot: ReactNode;
  ghost: ReactNode; // the answering slot, laid out but never shown or read
  cards: ReactNode;
  below?: ReactNode;
}

export function Stage({ slot, ghost, cards, below }: StageProps) {
  return (
    <>
      <div className="flex flex-col gap-4 pt-4">
        <div className="grid min-h-24 items-end">
          <div aria-hidden="true" inert className="invisible flex flex-col justify-end gap-4 [grid-area:1/1]">
            {ghost}
          </div>
          <div className="flex flex-col justify-end gap-4 [grid-area:1/1]">{slot}</div>
        </div>
        {cards}
      </div>
      {below && <div className="mt-5 flex flex-col gap-2">{below}</div>}
    </>
  );
}

// The round's main column and its side column: side by side from 64rem, the side below on a narrower screen.
export function RoundBody({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="round-body">
      <div className="round-main">{main}</div>
      <aside aria-label="Scores and answer" className="round-side">
        {side}
      </aside>
    </div>
  );
}
