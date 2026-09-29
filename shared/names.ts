// Player names (docs/product-specs/lobby.md). Shared, so the join form checks a name the way the server does.
export const NAME_MAX_LENGTH = 20;

// NFKC, without control or format characters (zero-width spaces, bidi overrides), with runs of whitespace
// collapsed and the ends trimmed. Null when nothing, or more than NAME_MAX_LENGTH characters, remains.
export function cleanName(raw: string): string | null {
  const name = raw
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX_LENGTH ? name : null;
}

// Names are unique per lobby, ignoring case.
export function nameKey(name: string): string {
  return name.toLowerCase();
}
