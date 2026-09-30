// The round's stage: a slot above the cards, the cards, and what follows them. The slot keeps one height and
// the stage fills a phone's first screen, so the cards sit in the same place, within thumb reach, from the
// face-down deal through the answer. The reveal lays out its own, with the verdict first.
import type { ReactNode } from 'react';

interface StageProps {
  slot: ReactNode;
  cards: ReactNode;
  below?: ReactNode;
}

export function Stage({ slot, cards, below }: StageProps) {
  return (
    <>
      <div className="flex min-h-[calc(100dvh-15rem)] flex-col justify-end gap-4 pt-4 sm:min-h-0">
        <div className="flex min-h-24 flex-1 flex-col justify-end gap-4">{slot}</div>
        {cards}
      </div>
      {below && <div className="mt-5 flex flex-col gap-2">{below}</div>}
    </>
  );
}
