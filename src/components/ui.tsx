// The building blocks the screens share: buttons, panels, fields and icons. Colors come from the theme
// tokens in styles.css.
import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Each theme prints its buttons on its own stock (.button in styles.css), in its display face.
const BUTTON_BASE =
  'button display inline-flex items-center justify-center gap-2 transition ' +
  'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-accent';

const BUTTON_VARIANTS = {
  primary: `${BUTTON_BASE} button-primary px-4 py-2.5`,
  // Secondary actions are a size smaller, so a phone's header holds them on one line in every face.
  quiet: `${BUTTON_BASE} button-quiet px-3 py-2 text-sm`,
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

// For an element that acts as a button without being one, such as a menu's summary.
export function buttonClass(variant: ButtonVariant): string {
  return BUTTON_VARIANTS[variant];
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
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
  'field w-full px-3 py-2.5 text-ink placeholder:text-muted ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section className={`panel p-4 sm:p-6 ${className}`}>
      {title && <h2 className="display mb-3 text-xl">{title}</h2>}
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
