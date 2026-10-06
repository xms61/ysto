// The seven reactions: six of the platform's own emoji, which every player reads at a glance, and the game's
// own "?!" in the world's display face. The emoji are written as escapes, so the source stays plain text.
import type { ReactionKind } from '../../shared/protocol.ts';

export const REACTION_LABELS: Record<ReactionKind, string> = {
  hype: 'Hype',
  laugh: 'Laugh',
  shock: 'Shock',
  facepalm: 'Facepalm',
  heart: 'Heart',
  clap: 'Clap',
  what: 'What?!',
};

const EMOJI: Record<Exclude<ReactionKind, 'what'>, string> = {
  hype: '\u{1F525}', // fire
  laugh: '\u{1F602}', // face with tears of joy
  shock: '\u{1F631}', // face screaming in fear
  facepalm: '\u{1F926}', // person facepalming
  heart: '\u{2764}\u{FE0F}', // red heart, as emoji
  clap: '\u{1F44F}', // clapping hands
};

export function ReactionIcon({ kind }: { kind: ReactionKind }) {
  if (kind === 'what') {
    return (
      <span aria-hidden="true" className="reaction-icon reaction-bang display">
        ?!
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="reaction-icon reaction-emoji">
      {EMOJI[kind]}
    </span>
  );
}
