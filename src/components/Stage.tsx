// The round's stage: a slot above the cards, the cards, and what follows them. The cards never move from the
// deal to the reveal: the slot lays a hidden copy of the round's countdown, timer and verdict (the ghost) under
// what it shows, so it always takes the tallest of their heights, and the cards hang from its foot, so a card
// that grows (a title that wraps) grows downward. The lines below the cards keep a fixed height, empty at
// the reveal, so on a phone the scores under the stage stay put too. RoundBody sets the stage between the
// scores and the answer on a wide screen.
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
      <div className="stage-below">{below}</div>
    </>
  );
}

// The round's three parts: the stage in the middle, the scores on its left, and on its right the answer at the
// reveal, in a column kept free for it from the start, so it shows up without moving anything. Between 64rem
// and 72rem the answer comes under the stage; on a narrower screen the scores follow the stage and the answer
// comes last.
export function RoundBody({ main, scores, answer }: { main: ReactNode; scores: ReactNode; answer?: ReactNode }) {
  return (
    <div className="round-body">
      <div className="round-main">{main}</div>
      <div className="round-scores">{scores}</div>
      <div className="round-answer">{answer}</div>
    </div>
  );
}

// The scores column's frame, the same while the round runs and at the reveal.
export function ScoresPanel({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="round-scores" className="side-scores">
      <h3 id="round-scores" className="side-heading">
        Scores
      </h3>
      {children}
    </section>
  );
}
