import { createHitmoAdapter } from "@/lib/download/sources/hitmo";
import type { SourceAdapter } from "@/lib/download/types";

// Per-source timeout. Kept short (not the original 10s) because the whole
// approve request's background work (see pipeline.ts, triggered via
// next/server's after()) counts against the route's maxDuration on
// Vercel — worst case is every configured source timing out back-to-back,
// so this number times SOURCES.length must stay comfortably under that
// limit, not butt up against it.
export const SOURCE_TIMEOUT_MS = 8000;

// Priority order from the TZ (section 3.4): Hitmo -> Sefon -> Zaycev.net ->
// MP3Juice. Only Hitmo is wired up right now — the other three were
// investigated by hand against their real, live HTML (not guessed) and
// each has a real blocker:
//   - Sefon: track listing is in plain HTML (title/artist/duration are
//     scrapable), but the actual mp3 URL is only available through a
//     proprietary obfuscated `data-url` that their own JS decodes
//     client-side — not reverse-engineered from a single sample.
//   - Zaycev.net: the search RESULTS are fetched client-side after the
//     page loads (React/Redux) — the server-rendered HTML's <h1> confirms
//     it's a "results for X" page, but the track cards in that initial
//     HTML are unrelated trending content, not the actual matches.
//   - MP3Juice: no stable domain found at all — every guess either failed
//     DNS resolution, redirected to an unrelated brand, or landed on a
//     parked/placeholder hosting page.
// Decision (confirmed with the user): ship with Hitmo only for now, keep
// this list as the single place to add a source back once one of the above
// is actually solved (a real API endpoint found, or a decode function
// obtained) — nothing else in the pipeline needs to change to add one.
export function getSources(): SourceAdapter[] {
  return [createHitmoAdapter(SOURCE_TIMEOUT_MS)];
}
