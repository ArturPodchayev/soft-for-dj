"use client";

import { useEffect, useState } from "react";
import { extractPalette, type Rgb } from "@/lib/ambientPalette";

// Re-extracts only when the thumbnail URL itself changes (i.e. on track
// change), not on every Realtime event that leaves it unchanged. Empty
// array (extraction not done yet, or failed) is a valid steady state — both
// AmbientBackground and AmbientBackgroundGL treat it as "use the venue's
// brand fallback colors."
export function useAlbumPalette(imageUrl: string | null): Rgb[] {
  const [trackedUrl, setTrackedUrl] = useState(imageUrl);
  const [palette, setPalette] = useState<Rgb[]>([]);

  // Clears the previous track's colors synchronously during render instead
  // of in an effect, so there's never a frame where the old palette lingers
  // under the new track's thumbnail.
  if (imageUrl !== trackedUrl) {
    setTrackedUrl(imageUrl);
    setPalette([]);
  }

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    extractPalette(imageUrl).then((result) => {
      if (!cancelled) setPalette(result);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return palette;
}
