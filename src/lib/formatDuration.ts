// Formats a (possibly fractional, possibly negative) seconds value as
// "M:SS" — negative values (a countdown that's run past zero because the
// moderator hasn't advanced yet) clamp to "0:00" rather than showing a
// minus sign.
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
