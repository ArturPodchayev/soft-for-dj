// "Artist - Title.mp3", with characters illegal in Windows/macOS filenames
// (the DJ's laptop, per the TZ's Google Drive Desktop -> Serato Watch
// Folder setup) stripped or replaced. Collapses whitespace and trims to a
// sane length so a very long guest-typed title can't produce an
// unreasonably long filename.
const ILLEGAL_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const MAX_LENGTH = 180;

function sanitizePart(value: string): string {
  return value
    .replace(ILLEGAL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFileName(artist: string, title: string): string {
  const name = `${sanitizePart(artist)} - ${sanitizePart(title)}`.slice(0, MAX_LENGTH).trim();
  return `${name || "Untitled"}.mp3`;
}
