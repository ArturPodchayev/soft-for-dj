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

// One source adapter's contract: given the search query, return whatever
// candidates it finds (already parsed off its results page), or throw. The
// pipeline (pipeline.ts) owns timeouts/try-catch/logging around this call —
// an adapter itself just does the scrape.
export type SourceAdapter = {
  name: SourceName;
  search: (artist: string, title: string) => Promise<SourceCandidate[]>;
};
