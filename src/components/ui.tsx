// The building blocks the screens share: buttons, panels, fields and icons. Colors come from the theme
// tokens in styles.css.
import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-accent';

const BUTTON_VARIANTS = {
  primary: `${BUTTON_BASE} bg-accent text-accent-ink hover:brightness-110`,
  quiet: `${BUTTON_BASE} border border-line bg-raised text-ink hover:border-accent`,
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`${BUTTON_VARIANTS[variant]} ${className}`} {...props} />;
}

// A button whose action affects others or can't be undone asks once more before it acts.
export function ConfirmButton({
  label,
  question,
  onConfirm,
}: {
  label: string;
  question: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="quiet" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{question}</span>
      <Button variant="quiet" onClick={onConfirm}>
        Yes
      </Button>
      <Button variant="quiet" onClick={() => setAsking(false)}>
        No
      </Button>
    </span>
  );
}

export const INPUT =
  'w-full rounded-lg border border-line bg-page px-3 py-2.5 text-ink placeholder:text-muted ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 sm:p-6 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0">
      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0">
      <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
