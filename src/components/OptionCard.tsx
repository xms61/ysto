// A round's options as cards on the theme's card stock (docs/DESIGN.md). The four are always equal: the same
// stock, size and index mark, and all four turn face up together in the same frame, exactly when the clip
// starts, so no option shows before another. Before that they lie face down; at the reveal the right card
// turns over to its printed back and lands with its theme's hit. A tag such as "Your pick" is a stamp on the
// card's edge, outside its faces, so it never changes the card's size. Nor does the reveal: each card carries a
// hidden copy of the back it would show if it were the answer (its sizer), at its longest, so its row already
// has the back's height before any card turns over.
import type { CSSProperties, ReactNode } from 'react';
import type { OptionTitle, Title } from '../format.ts';
import { useOptionColumns } from '../themes/stage.ts';
import { Burst } from './Burst.tsx';
import { CheckIcon } from './ui.tsx';

// open: answerable; chosen: this player's pick; muted: stepped back (locked in, or not the answer);
// missed: this player's wrong pick; right: the answer, turned over.
export type CardState = 'open' | 'chosen' | 'muted' | 'missed' | 'right';

interface OptionCardProps {
  index: number;
  title: OptionTitle;
  state: CardState;
  tag?: ReactNode;
  mark?: string; // printed on the face at the reveal, such as Tokyo Rain's "Sold out"
  back?: ReactNode;
  sizer?: ReactNode; // the back this card would show at its longest, laid out but never shown
  dealt?: boolean; // turned face up from its back as the clip starts
  heat?: number; // 1 to 3: how hard the right card lands, from this player's streak
  onPick?: () => void;
  disabled?: boolean;
}

const FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-accent';

// Motes in the right card's burst, by heat: a streak lands harder.
const BURST_BY_HEAT = [0, 12, 18, 26];

export function OptionCard(props: OptionCardProps) {
  const { index, title, state, tag, mark, back, sizer, dealt = false, heat = 1, onPick, disabled = false } = props;
  const turned = state === 'right' && back !== undefined;
  const faces = (
    <span className="card-turn">
      <span className="card-face card-front">
        <span aria-hidden="true" className="card-index">
          {index + 1}
        </span>
        <span className="card-title" lang={title.lang} data-language={title.language}>
          {title.text}
          {title.second && <SecondTitle title={title.second} />}
          {turned && <span className="sr-only"> (the right answer)</span>}
        </span>
        {mark && (
          <span aria-hidden="true" className="card-mark-plate">
            {mark}
          </span>
        )}
      </span>
      {turned && (
        <span aria-hidden="true" className="card-face card-back">
          {back}
        </span>
      )}
      {sizer && <Sizer>{sizer}</Sizer>}
      {dealt && <PrintedBack />}
    </span>
  );
  const stamp = tag && <span className="card-tag">{tag}</span>;
  if (onPick) {
    return (
      <button
        type="button"
        className={`card ${FOCUS} enabled:cursor-pointer`}
        data-state={state}
        data-dealt={dealt || undefined}
        disabled={disabled}
        onClick={onPick}
      >
        {faces}
        {stamp}
      </button>
    );
  }
  return (
    <div className="card" data-state={state} data-turned={turned || undefined} data-heat={turned ? heat : undefined}>
      {faces}
      {stamp}
      {turned && (
        <span aria-hidden="true" className="card-impact">
          <Burst count={BURST_BY_HEAT[heat] ?? 12} reach={5 + heat * 1.5} delayMs={820} />
        </span>
      )}
    </div>
  );
}

// The title in the player's second language, under the first. It names its own language, since it sits
// inside the first title's element.
export function SecondTitle({ title }: { title: Title }) {
  return (
    <>
      <span className="sr-only">, </span>
      <span className="card-second" lang={title.lang ?? 'en'} data-language={title.language}>
        {title.text}
      </span>
    </>
  );
}

// The right card's back: what it says, and the title with its second language. Which song it was, the answer
// column says.
export function AnswerBack({ label, title }: { label: string; title: OptionTitle }) {
  return (
    <>
      <span className="card-back-label">
        <CheckIcon />
        {label}
      </span>
      <span className="card-back-title" lang={title.lang} data-language={title.language}>
        {title.text}
        {title.second && <SecondTitle title={title.second} />}
      </span>
    </>
  );
}

// The back at its longest for a title: the label with "your pick".
export function AnswerSizer({ title }: { title: OptionTitle }) {
  return <AnswerBack label="Right answer, your pick" title={title} />;
}

function Sizer({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="card-face card-back card-sizer">
      {children}
    </span>
  );
}

// The back every card is printed with: the game's "?!" in the theme's back colors. Nothing on it says which
// option lies underneath.
function PrintedBack({ down = false }: { down?: boolean }) {
  return (
    <span aria-hidden="true" className={`card-face card-back card-printed ${down ? 'card-down' : ''}`}>
      <span className="card-emblem">?!</span>
    </span>
  );
}

// The four cards as dealt before the clip starts: backs up, nothing to read yet. They slide in off the deck
// one after another, then idle until the clip starts and they turn face up together. The titles aren't known
// yet, so each holds the height of a back with a title of typical length, and only a longer title grows its
// row when they turn face up.
const TYPICAL: OptionTitle = { text: 'A typical anime title', lang: undefined, language: 'english', second: null };

export function FaceDownCards({ second }: { second: boolean }) {
  const title: OptionTitle = second
    ? { ...TYPICAL, second: { text: 'Its second title', lang: undefined, language: 'romaji' } }
    : TYPICAL;
  const columns = useOptionColumns();
  return (
    <ul aria-hidden="true" className={`options grid ${columns} gap-3`}>
      {[0, 1, 2, 3].map((slot) => (
        <li key={slot} className="card card-dealing" data-state="down" style={{ '--deal': slot } as CSSProperties}>
          <span className="card-turn">
            <PrintedBack down />
            <Sizer>
              <AnswerSizer title={title} />
            </Sizer>
          </span>
        </li>
      ))}
    </ul>
  );
}
