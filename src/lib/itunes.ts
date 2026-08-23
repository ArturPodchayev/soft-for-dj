import { looksLikeMatch } from "@/lib/fuzzyMatch";
import { fetchWithTimeout } from "@/lib/http";

const SEARCH_URL = "https://itunes.apple.com/search";
const REQUEST_TIMEOUT_MS = 8000;

export type ItunesTrackInfo = {
  // Only populated when the result passes looksLikeMatch against the
  // original (pre-normalization) artist/title — never auto-applied
  // otherwise, even if iTunes returned something. A normalization step has
  // confidently hallucinated an unrelated track before, so a raw "iTunes
  // returned a result" is never trusted blindly.
  artworkUrl: string | null;
  durationSeconds: number | null;
};

const NOT_FOUND: ItunesTrackInfo = { artworkUrl: null, durationSeconds: null };

// iTunes Search API is open — no key, no auth, just a GET request. Falls
// back to nulls on anything short of a clean match (no results, timeout,
// non-200) so a hiccup here never blocks Approve.
//
// Takes a pre-built query (normalizeSongQuery's output) rather than
// separate artist/title — iTunes' catalog is indexed by the original
// (usually Latin-script) title, so a raw Cyrillic phonetic spelling often
// finds nothing there without normalization first.
// originalArtistName/originalSongTitle are the *raw, pre-normalization*
// values, used only to sanity-check the result.
export async function searchItunesTrackInfo(
  query: string,
  originalArtistName: string,
  originalSongTitle: string
): Promise<ItunesTrackInfo> {
  try {
    // normalizeSongQuery() returns "Artist - Song Title" — the literal " - "
    // measurably skews which result iTunes ranks first, so strip it to get
    // the kind of query a human would type.
    const term = encodeURIComponent(query.replace(/ - /g, " "));
    const res = await fetchWithTimeout(`${SEARCH_URL}?term=${term}&entity=song&limit=1`, {}, REQUEST_TIMEOUT_MS);

    if (!res.ok) {
      console.error("iTunes search failed", { status: res.status });
      return NOT_FOUND;
    }

    const data = await res.json();
    const track = data.results?.[0];
    if (!track) return NOT_FOUND;

    const foundArtist: string = track.artistName ?? "";
    const foundTrack: string = track.trackName ?? "";

    const confident = looksLikeMatch(
      `${originalArtistName} ${originalSongTitle}`,
      `${foundArtist} ${foundTrack}`
    );
    if (!confident) {
      console.log("iTunes result doesn't resemble the original request, not auto-applying it", {
        original: `${originalArtistName} - ${originalSongTitle}`,
        found: `${foundArtist} - ${foundTrack}`,
      });
    }

    const artworkUrl100: string | undefined = track.artworkUrl100;
    // Standard iTunes trick: the artwork URL encodes its own size
    // ("100x100bb.jpg") — swapping in a larger size returns the same image
    // at that resolution, no separate endpoint needed.
    const artworkUrl = confident && artworkUrl100 ? artworkUrl100.replace("100x100", "600x600") : null;

    const trackTimeMillis: number | undefined = track.trackTimeMillis;
    const durationSeconds =
      confident && typeof trackTimeMillis === "number" ? Math.round(trackTimeMillis / 1000) : null;

    return { artworkUrl, durationSeconds };
  } catch (err) {
    console.error("iTunes search failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NOT_FOUND;
  }
}
