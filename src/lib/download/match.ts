import { compareTwoStrings } from "string-similarity";

// Fuzzy-match thresholds — Dice coefficient (bigram overlap) via
// string-similarity, on "{artist} - {title}" strings. Two named constants,
// not a single cutoff: below REJECT the candidate is dropped outright and
// never counted as a source result; between REJECT and CONFIRM it's a grey
// zone (best-effort match, but not confident enough to auto-download) that
// becomes a 'needs_review' fallback; at/above CONFIRM the candidate is
// trusted enough to download and duration-check.
//
// Starting points, not tuned against real production data yet — revisit
// once this has run against a batch of real guest requests.
export const FUZZY_CONFIRM_THRESHOLD = 0.7;
export const FUZZY_REJECT_THRESHOLD = 0.5;

export function fuzzyScore(expected: { artist: string; title: string }, candidate: { artist: string; title: string }): number {
  return compareTwoStrings(
    `${expected.artist} - ${expected.title}`.toLowerCase(),
    `${candidate.artist} - ${candidate.title}`.toLowerCase()
  );
}

// Duration tolerance for comparing the requested track's expected length
// (from the iTunes lookup already run on approve, see the approve route)
// against a downloaded candidate's actual measured length.
export const DURATION_TOLERANCE_SECONDS = 10;

export function durationMatches(expectedSeconds: number, actualSeconds: number): boolean {
  return Math.abs(expectedSeconds - actualSeconds) <= DURATION_TOLERANCE_SECONDS;
}

// remix/cover/live/instrumental/acoustic — reject a candidate whose title
// carries one of these words when the guest's own request didn't ask for
// it. Checked before downloading anything (see pipeline.ts), so a mismatch
// here costs nothing but a string comparison.
const VERSION_KEYWORDS = ["remix", "cover", "live", "instrumental", "acoustic"];

export function hasUnwantedVersionKeyword(requestedTitle: string, candidateTitle: string): boolean {
  const requested = requestedTitle.toLowerCase();
  const candidate = candidateTitle.toLowerCase();
  return VERSION_KEYWORDS.some((word) => candidate.includes(word) && !requested.includes(word));
}
