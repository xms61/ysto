// What changed for players, by version, for the dialog on the first visit after an update
// (docs/product-specs/settings.md). Written for players, apart from CHANGELOG.md: one short line per change,
// and a version nobody would notice has no entry. Newest first.
import { readItem, writeItem } from './storage.ts';

const NOTES: { version: string; lines: string[] }[] = [
  { version: '1.29.0', lines: ['Many more lobbies can be open at once, so "server full" should be rare.'] },
  { version: '1.28.0', lines: ["Today's challenge shares as colored squares, ready to paste into Discord."] },
  { version: '1.27.0', lines: ['Party mode: one screen plays the sound, and everyone answers on their phone.'] },
  { version: '1.26.0', lines: ["Today's challenge: ten songs a day, the same for everyone, and a streak to keep."] },
  { version: '1.25.0', lines: ['Type your answer: hosts can swap the four options for a title field.'] },
  { version: '1.24.0', lines: ['Name the song title or the artist instead of the anime, or mix them up.'] },
  { version: '1.23.0', lines: ['Teams: split into up to four teams, each scoring the average of its players.'] },
  { version: '1.22.0', lines: ['Elimination: lose a life for each miss, and the last one standing wins.'] },
  { version: '1.21.0', lines: ['Hints: hosts can let players see when the anime aired, for 70% of the points.'] },
  { version: '1.20.0', lines: ['The overtime looks different in every world.'] },
  { version: '1.19.0', lines: ['Sound effects in every world, with a switch in Preferences.'] },
  {
    version: '1.18.0',
    lines: ['Neon Rain: Tokyo at night in the rain, holographic ads and all, replaces Tokyo Rain and Konbini.'],
  },
  { version: '1.17.0', lines: ['Nine worlds now: six were retired, and their players start back in Tokyo Rain.'] },
  { version: '1.16.0', lines: ['Endless games: the songs keep coming until the host ends the game.'] },
  {
    version: '1.15.0',
    lines: [
      'Emoji reactions, any time, and a ?! of our own.',
      'The round fits your screen: cards fill the middle, nothing moves at the reveal.',
    ],
  },
  { version: '1.14.0', lines: ['Scores on the left, the answer on the right, and the cards stay put at the reveal.'] },
  { version: '1.13.0', lines: ['Your games: look back at the games you played here, and every anime you heard.'] },
  { version: '1.12.0', lines: ['Hosts can save their favorite settings and load them in any lobby.'] },
  { version: '1.11.0', lines: ['Pick your animal in the lobby: it stamps your picks at the reveal.'] },
  { version: '1.10.0', lines: ['The cards stay put at the reveal, and the scores sit beside them on a wide screen.'] },
  { version: '1.9.0', lines: ['Big screens, such as 4K monitors and TVs, show the game larger.'] },
  { version: '1.8.0', lines: ['React to a reveal: six reactions rise from your name for everyone to see.'] },
  { version: '1.7.0', lines: ['Play again in the same lobby: it keeps count of who has won.'] },
  { version: '1.6.0', lines: ['A clip sounds broken? Report it from the reveal or the song list.'] },
  { version: '1.4.0', lines: ['The results list every song of the game, with a link to AnimeThemes.'] },
  { version: '1.2.0', lines: ['Answers can change until the round closes, if your host turns it on.'] },
  { version: '1.1.0', lines: ['Titles can show in two languages: pick a second one in Preferences.'] },
];

export const MAX_LINES = 3;

// Released storage keys are permanent.
const SEEN_KEY = 'ysto_seen_version';
// Saved preferences, kept since 1.0.0, mark a device that played before the dialog came in 1.5.0.
const PREFS_KEY = 'ysto_prefs';
const BEFORE_NOTES = '1.0.0';

function parts(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

function isNewer(version: string, than: string): boolean {
  const [a, b] = [parts(version), parts(than)];
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

// The version this device last saw: none on a first visit, and 1.0.0 for one that played before the dialog.
function seenVersion(storage: Storage | null): string | null {
  return readItem(storage, SEEN_KEY) ?? (readItem(storage, PREFS_KEY) === null ? null : BEFORE_NOTES);
}

// The lines to show on this visit: the newest three from the versions after the one this device last saw, up
// to this page's. A first visit, or storage that is blocked, shows nothing: everything is new to it.
export function notesToShow(storage: Storage | null, current: string): string[] {
  const seen = seenVersion(storage);
  if (seen === null) {
    writeItem(storage, SEEN_KEY, current);
    return [];
  }
  return NOTES.filter((note) => isNewer(note.version, seen) && !isNewer(note.version, current))
    .flatMap((note) => note.lines)
    .slice(0, MAX_LINES);
}

export function markSeen(storage: Storage | null, current: string): void {
  writeItem(storage, SEEN_KEY, current);
}
