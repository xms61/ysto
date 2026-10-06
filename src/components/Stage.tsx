// The round's stage: a slot above the cards, the cards, and what follows them. The cards never move from the
// deal to the reveal: the slot lays a hidden copy of the round's countdown, timer and verdict (the ghost) under
// what it shows, so it always takes the tallest of their heights, and the cards hang from its foot, so a card
// that grows (a title that wraps) grows downward. RoundBody sets the stage between the scores and the answer
// on a wide screen, where the cards fill the window's height at a fixed size, their foot level with the
// scores column's, and their text shrinks to fit them instead.
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

const WIDE = '(min-width: 64rem)';
const FIT_STEP = 0.05;
const FIT_FLOOR = 0.55;

const CARD_TEXT = '.card-title, .card-back-label, .card-back-title';

// Whether any card's text runs past its face. Only the text counts: some worlds draw ornaments past the edge.
function overflows(stage: HTMLElement): boolean {
  return [...stage.querySelectorAll<HTMLElement>('.options .card-face')].some((face) => {
    const box = face.getBoundingClientRect();
    return [...face.querySelectorAll<HTMLElement>(CARD_TEXT)].some((text) => {
      const line = text.getBoundingClientRect();
      return line.bottom > box.bottom + 1 || line.right > box.right + 1;
    });
  });
}

// On a wide screen every card is the same fixed size, so a long title shrinks instead: the text on all four
// cards scales down together (--fit) until none overflows its face. The hidden backs count, so the scale is
// the same while answering and at the reveal and no title wraps anew when the right card turns over.
function useFitCards(stage: RefObject<HTMLDivElement | null>, cards: ReactNode): void {
  useLayoutEffect(() => {
    const element = stage.current;
    const options = element?.querySelector<HTMLElement>('.options');
    if (!element || !options) return;
    const fit = () => {
      options.style.removeProperty('--fit');
      if (!window.matchMedia?.(WIDE).matches) return;
      for (let scale = 1; scale > FIT_FLOOR && overflows(element); scale -= FIT_STEP) {
        options.style.setProperty('--fit', (scale - FIT_STEP).toFixed(2));
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(options);
    return () => observer.disconnect();
  }, [stage, cards]);
}

interface StageProps {
  slot: ReactNode;
  ghost: ReactNode; // the answering slot, laid out but never shown or read
  cards: ReactNode;
}

export function Stage({ slot, ghost, cards }: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  useFitCards(stage, cards);
  return (
    <div ref={stage} className="stage flex flex-col gap-7 pt-4">
      <div className="grid min-h-24 items-end">
        <div aria-hidden="true" inert className="invisible flex flex-col justify-end gap-4 [grid-area:1/1]">
          {ghost}
        </div>
        <div className="flex flex-col justify-end gap-4 [grid-area:1/1]">{slot}</div>
      </div>
      {cards}
    </div>
  );
}

// The round's three parts: the stage in the middle, the scores on its left, and on its right the answer at the
// reveal, in a column kept free for it from the start, so it shows up without moving anything. On a screen
// narrower than 64rem the scores follow the stage and the answer comes last.
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
