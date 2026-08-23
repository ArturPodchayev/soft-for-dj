// Pure, side-effect-free helpers — safe to import from client components.
export function extractYoutubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    if (parsed.hostname.endsWith("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;

      const match = /^\/(embed|shorts)\/([^/?]+)/.exec(parsed.pathname);
      if (match) return match[2];
    }

    return null;
  } catch {
    return null;
  }
}

// YouTube always generates default/mqdefault/hqdefault for any video with a
// thumbnail, but sddefault and maxresdefault only exist for videos uploaded
// at high enough source resolution. When they're missing, YouTube's CDN
// doesn't 404 — it silently serves a fixed 120x90 gray placeholder with an
// HTTP 200, so only the decoded image's actual dimensions can tell a real
// thumbnail from a miss (see useVerifiedThumbnail.ts, which probes this
// list). Ordered best -> guaranteed-worst: hqdefault is never probed, it's
// the unconditional final fallback.
export const YOUTUBE_PLACEHOLDER_DIMENSIONS = { width: 120, height: 90 };

export function getYoutubeThumbnailTiers(videoId: string): string[] {
  return ["maxresdefault", "sddefault", "hqdefault"].map(
    (tier) => `https://img.youtube.com/vi/${videoId}/${tier}.jpg`
  );
}

export function getYoutubeThumbnailUrl(videoId: string): string {
  return getYoutubeThumbnailTiers(videoId)[0];
}
