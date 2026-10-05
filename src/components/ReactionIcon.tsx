// The six reactions, drawn for this game in the theme's ink: no emoji, no borrowed artwork.
import type { ReactionKind } from '../../shared/protocol.ts';

export const REACTION_LABELS: Record<ReactionKind, string> = {
  hype: 'Hype',
  laugh: 'Laugh',
  shock: 'Shock',
  facepalm: 'Facepalm',
  heart: 'Heart',
  clap: 'Clap',
};

function Strokes({ kind }: { kind: ReactionKind }) {
  switch (kind) {
    case 'hype':
      return (
        <path d="M12 3c1 3.2 5 5.4 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.4-4.8.1 2.2 1 3.4 2.4 3.6-.6-3.2-.8-5.8.2-8.8z" />
      );
    case 'laugh':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M7.5 10q1.25-1.6 2.5 0M14 10q1.25-1.6 2.5 0M7.5 13.5h9a4.5 4.5 0 0 1-9 0z" />
        </>
      );
    case 'shock':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="9.5" r="1" fill="currentColor" />
          <circle cx="15" cy="9.5" r="1" fill="currentColor" />
          <ellipse cx="12" cy="15.5" rx="2" ry="2.5" />
        </>
      );
    case 'facepalm':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <rect x="5.5" y="7" width="11" height="5" rx="2.5" transform="rotate(-18 11 9.5)" fill="currentColor" />
          <path d="M10 16.5h4" />
        </>
      );
    case 'heart':
      return <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />;
    case 'clap':
      return (
        <>
          <rect x="5.5" y="8.5" width="6" height="11" rx="3" transform="rotate(-18 8.5 14)" />
          <rect x="12.5" y="8.5" width="6" height="11" rx="3" transform="rotate(18 15.5 14)" />
          <path d="M12 2.5v2.5M7.5 3.5l1.2 1.8M16.5 3.5l-1.2 1.8" />
        </>
      );
  }
}

export function ReactionIcon({ kind }: { kind: ReactionKind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="reaction-icon"
    >
      <Strokes kind={kind} />
    </svg>
  );
}
