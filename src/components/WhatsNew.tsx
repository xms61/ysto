// The dialog on the first visit after an update: what changed, in up to three short lines, and one button.
// Escape or a tap outside closes it too (src/whats-new.ts).
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { buttonClass } from './ui.tsx';

export function WhatsNew({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="whats-new-heading"
      className="whats-new panel"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id="whats-new-heading" className="display text-xl">
        What's new
      </h2>
      <ul className="whats-new-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button type="button" className={buttonClass('primary')} onClick={onClose} autoFocus>
        Got it
      </button>
    </dialog>,
    document.body,
  );
}
