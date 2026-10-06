// Titles compared the way players can't tell apart: full and half width, case and runs of spaces don't count.
// The server matches options and typed answers with it, and the client a typed answer's free text.
export function normalizeTitle(title: string): string {
  return title.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
