// A round's options as cards on the theme's card stock (docs/DESIGN.md). The four are always equal: the same
// stock, size and index mark, and they never animate in, so every player can read them the moment the clip
// starts. Before that they lie face down; at the reveal the right card turns over to its printed back. A tag
// such as "Your pick" is a stamp on the card's edge, outside its faces, so it never changes the card's size.
import type { ReactNode } from 'react';

// open: answerable; chosen: this player's pick; muted: stepped back (locked in, or not the answer);
// missed: this player's wrong pick; right: the answer, turned over.
export type CardState = 'open' | 'chosen' | 'muted' | 'missed' | 'right';

interface OptionCardProps {
  index: number;
  title: string;
  lang: string | undefined;
  state: CardState;
  tag?: ReactNode;
  back?: ReactNode;
  onPick?: () => void;
  disabled?: boolean;
}

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent';

export function OptionCard({ index, title, lang, state, tag, back, onPick, disabled = false }: OptionCardProps) {
  const turned = state === 'right' && back !== undefined;
  const faces = (
    <span className="card-turn">
      <span className="card-face card-front">
        <span aria-hidden="true" className="card-index">
          {index + 1}
        </span>
        <span className="card-title" lang={lang}>
          {title}
          {turned && <span className="sr-only"> (the right answer)</span>}
        </span>
      </span>
      {turned && (
        <span aria-hidden="true" className="card-face card-back">
          {back}
        </span>
      )}
    </span>
  );
  const stamp = tag && <span className="card-tag">{tag}</span>;
  if (onPick) {
    return (
      <button
        type="button"
        className={`card ${FOCUS} enabled:cursor-pointer`}
        data-state={state}
        disabled={disabled}
        onClick={onPick}
      >
        {faces}
        {stamp}
      </button>
    );
  }
  return (
    <div className="card" data-state={state} data-turned={turned || undefined}>
      {faces}
      {stamp}
    </div>
  );
}

// The four cards as dealt before the clip starts: backs up, nothing to read yet.
export function FaceDownCards() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((slot) => (
        <li key={slot} className="card" data-state="down">
          <span className="card-turn">
            <span className="card-face card-back card-down" />
          </span>
        </li>
      ))}
    </ul>
  );
}
