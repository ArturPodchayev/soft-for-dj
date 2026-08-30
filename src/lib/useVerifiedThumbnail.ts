"use client";

import { useEffect, useState } from "react";
import { getYoutubeThumbnailTiers, YOUTUBE_PLACEHOLDER_DIMENSIONS } from "@/lib/youtubeThumbnail";

const YOUTUBE_THUMBNAIL_HOST = "img.youtube.com";

function isPlaceholder(img: HTMLImageElement): boolean {
  return (
    img.naturalWidth === YOUTUBE_PLACEHOLDER_DIMENSIONS.width &&
    img.naturalHeight === YOUTUBE_PLACEHOLDER_DIMENSIONS.height
  );
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(!isPlaceholder(img));
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// The unverified maxresdefault guess is never rendered directly — a
// YouTube-sourced candidate starts pinned to its own guaranteed-good final
// tier (hqdefault) until the effect below confirms a higher one is real.
// Non-YouTube URLs (iTunes/manual) pass through untouched.
function safeInitialUrl(candidateUrl: string | null): string | null {
  if (!candidateUrl || !candidateUrl.includes(YOUTUBE_THUMBNAIL_HOST)) return candidateUrl;
  const videoId = /\/vi\/([^/]+)\//.exec(candidateUrl)?.[1];
  if (!videoId) return candidateUrl;
  const tiers = getYoutubeThumbnailTiers(videoId);
  return tiers[tiers.length - 1];
}

// getSongThumbnailUrl's YouTube branch (lib/albumArt.ts) hands back
// maxresdefault.jpg optimistically — see getYoutubeThumbnailTiers' docblock
// for why that tier can silently be a 120x90 placeholder instead of a real
// 404. This hook re-derives the same video's tier list from the URL and
// probes maxres -> sd in the background, only ever rendering hqdefault.jpg
// until a higher tier is confirmed real — so the visible thumbnail never
// shows YouTube's gray placeholder. Shared by every screen that renders a
// track thumbnail (the projector display, the DJ view).
export function useVerifiedThumbnailUrl(candidateUrl: string | null): string | null {
  const [trackedCandidate, setTrackedCandidate] = useState(candidateUrl);
  const [resolvedUrl, setResolvedUrl] = useState(() => safeInitialUrl(candidateUrl));

  // Reset-on-prop-change-during-render: clears synchronously so there's
  // never a frame showing the previous track's resolved thumbnail under
  // the new track's data.
  if (candidateUrl !== trackedCandidate) {
    setTrackedCandidate(candidateUrl);
    setResolvedUrl(safeInitialUrl(candidateUrl));
  }

  useEffect(() => {
    if (!candidateUrl || !candidateUrl.includes(YOUTUBE_THUMBNAIL_HOST)) return;
    const videoId = /\/vi\/([^/]+)\//.exec(candidateUrl)?.[1];
    if (!videoId) return;

    const tiers = getYoutubeThumbnailTiers(videoId);
    let cancelled = false;

    (async () => {
      for (const tier of tiers.slice(0, -1)) {
        if (cancelled) return;
        if (await probe(tier)) {
          if (!cancelled) setResolvedUrl(tier);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidateUrl]);

  return resolvedUrl;
}
