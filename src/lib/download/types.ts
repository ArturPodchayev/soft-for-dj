// A single candidate found on a source's search-results page, before any
// file has been downloaded — just what the results listing itself shows.
export type SourceCandidate = {
  title: string;
  artist: string;
  /** Duration in seconds, if the source's search listing shows one. */
  durationSeconds: number | null;
  /** Absolute URL to the actual audio file (already resolved, not a track/detail page). */
  downloadUrl: string;
};

export type SourceName = "hitmo";

// One source adapter's contract. search(): given the query, return whatever
// candidates it finds (already parsed off its results page), or throw.
// download(): fetch a confirmed candidate's downloadUrl and return the raw
// Response — a separate method (not left to the pipeline's own generic
// fetch) specifically so a source that needs its own routing/auth to reach
// its files (e.g. Hitmo's Cloudflare Worker proxy, see
// src/lib/download/sources/hitmo.ts — Vercel's egress IPs get a straight
// 403 from Hitmo, confirmed live) can do that without leaking those details
// into pipeline.ts, which stays source-agnostic. The pipeline owns
// timeouts/try-catch/logging around both calls — an adapter itself just
// does the network work.
export type SourceAdapter = {
  name: SourceName;
  search: (artist: string, title: string) => Promise<SourceCandidate[]>;
  download: (url: string) => Promise<Response>;
};
