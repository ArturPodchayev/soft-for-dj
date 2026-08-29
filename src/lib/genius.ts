import { fetchWithTimeout } from "@/lib/http";

const SEARCH_URL = "https://api.genius.com/search";
const REQUEST_TIMEOUT_MS = 8000;
// Genius' search doesn't take a result-count param — it returns whatever it
// finds relevant (often 8-10), already relevance-ordered. Trimming to a
// handful keeps the admin picker grid from turning into a wall of thumbnails
// for a very generic query.
const MAX_CANDIDATES = 6;

export class GeniusNotConfiguredError extends Error {
  constructor() {
    super("GENIUS_ACCESS_TOKEN is not configured");
    this.name = "GeniusNotConfiguredError";
  }
}

export type GeniusCandidate = {
  id: number;
  title: string;
  artistName: string;
  // Full-size art (used as the actual album_art_url once picked) and a
  // smaller thumbnail (used for the picker grid) — Genius returns both per
  // hit, no separate request needed for either size.
  imageUrl: string;
  thumbnailUrl: string;
  geniusUrl: string;
};

type GeniusHit = {
  result?: {
    id?: number;
    title?: string;
    primary_artist?: { name?: string };
    song_art_image_url?: string;
    song_art_image_thumbnail_url?: string;
    url?: string;
  };
};

// Deliberately returns several raw candidates rather than auto-picking one
// and sanity-checking it (the way lib/itunes.ts does) — the admin UI shows
// these as a picker grid for the moderator to eyeball and choose from
// directly, so there's no algorithmic confidence gate to get wrong here; a
// human is already in the loop.
export async function searchGeniusArtwork(query: string): Promise<GeniusCandidate[]> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) {
    throw new GeniusNotConfiguredError();
  }

  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } }, REQUEST_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Genius search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const hits: GeniusHit[] = data?.response?.hits ?? [];

  return hits
    .map((hit) => hit.result)
    .filter((result): result is NonNullable<GeniusHit["result"]> => Boolean(result?.id && result.song_art_image_url))
    .map((result) => ({
      id: result.id as number,
      title: result.title ?? "",
      artistName: result.primary_artist?.name ?? "",
      imageUrl: result.song_art_image_url as string,
      thumbnailUrl: result.song_art_image_thumbnail_url ?? (result.song_art_image_url as string),
      geniusUrl: result.url ?? "",
    }))
    .slice(0, MAX_CANDIDATES);
}
