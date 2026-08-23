import { extractYoutubeVideoId, getYoutubeThumbnailUrl } from "@/lib/youtubeThumbnail";

export type ThumbnailSource = {
  album_art_url: string | null;
  youtube_url: string | null;
};

// Cascade: album_art_url (from the iTunes lookup on approve, or a
// moderator-pasted URL) -> YouTube thumbnail -> none. Shared by DisplayCard
// (the visible artwork) and the ambient background (the color it's tinted
// from), so the background always matches whatever art is actually on
// screen.
//
// The YouTube branch returns an optimistic maxresdefault.jpg guess — see
// getYoutubeThumbnailTiers' docblock for why that can silently be a broken
// placeholder. Both callers run this function's result through
// useVerifiedThumbnailUrl before rendering/sampling it; this function
// itself stays synchronous and doesn't verify anything.
export function getSongThumbnailUrl(song: ThumbnailSource | null): string | null {
  if (!song) return null;
  if (song.album_art_url) return song.album_art_url;
  const videoId = song.youtube_url ? extractYoutubeVideoId(song.youtube_url) : null;
  return videoId ? getYoutubeThumbnailUrl(videoId) : null;
}
