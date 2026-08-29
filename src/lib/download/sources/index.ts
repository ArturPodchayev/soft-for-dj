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
//
// UPDATE (2026-08-30): Hitmo itself turned out to be durably blocked from
// Vercel too, not just header-detectable. Timeline, confirmed live end to
// end (not guessed):
//   1. Direct request from Vercel's egress IP -> 403 from Hitmo's nginx,
//      even with a full realistic Chrome header set.
//   2. Routed the request through a Cloudflare Worker reverse proxy
//      (cloudflare-worker/hitmo-proxy.js) instead, on the theory that
//      Cloudflare's edge IPs are too widely used to blanket-block -> still
//      403, but *intermittently* 200 with real results — looked at first
//      like Hitmo's own anti-bot rate-limit reacting to the burst of live
//      testing this diagnosis itself generated.
//   3. Added retry-with-backoff for exactly that transient case, paused
//      testing for ~an hour to let any rate-limit expire, then re-tested
//      clean (one single approve, no probing around it) — still 403 on
//      3/3 attempts, real Hitmo homepage HTML in the body (not our own
//      Worker's secret check failing).
//   4. Found and fixed a real bug on the way: the Worker was blanket-
//      forwarding ALL of the incoming request's headers to Hitmo,
//      including Cloudflare's own CF-Connecting-IP (Vercel's real IP) —
//      switched to an explicit header allowlist. Retested clean again —
//      still 403, identical cf-ray colo suffix as every other attempt.
// Every single test landed on the same Cloudflare colo (Vercel's function
// region routes there consistently), so the working theory is that colo's
// specific egress IP(s) toward Hitmo are now durably blocklisted — not
// something fixable with headers, retries, or the proxy approach from this
// side. Decision (confirmed with the user): accept that Hitmo's automated
// chain doesn't work right now and lean on the existing manual fallback
// (TrackQuickActions' Hitmo/Sefon links, surfaced whenever a request ends
// up flagged_for_review) rather than keep chasing this. Left wired up
// as-is below rather than removed — it's free to keep trying in the
// background (after(), doesn't block the moderator) and costs nothing if
// Hitmo's block ever lifts on its own; revisit if it's worth checking
// again, or if a paid rotating-IP scraping API (ScraperAPI etc.) is ever
// worth the cost for this specific source.
export function getSources(): SourceAdapter[] {
  return [createHitmoAdapter(SOURCE_TIMEOUT_MS)];
}
