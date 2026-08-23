import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonServerClient } from "@/lib/supabase/server";
import { orderApprovedQueue } from "@/lib/queue";

export type DisplaySong = {
  song_title: string;
  artist_name: string;
  requester_name: string;
  youtube_url: string | null;
  album_art_url: string | null;
};

export type DisplayQueue = {
  playing: DisplaySong | null;
  next: DisplaySong | null;
};

const DISPLAY_COLUMNS = "song_title, artist_name, requester_name, youtube_url, album_art_url";

// Shared by the server-rendered first paint of /display (getDisplayQueue
// below, so the very first frame already shows the real state instead of an
// empty placeholder until the client's Realtime subscription delivers its
// first event) and the client re-fetch that runs on every Realtime change
// event (components/display/DisplayScreen.tsx) — one query, two callers,
// same reasoning as lib/queue.ts's orderApprovedQueue: "what's playing/next"
// must never be computed two different ways.
export async function fetchDisplayQueue(supabase: SupabaseClient): Promise<DisplayQueue> {
  const [playingResult, nextResult] = await Promise.all([
    supabase
      .from("song_requests")
      .select(DISPLAY_COLUMNS)
      .eq("status", "playing")
      // Deterministic tiebreak in case more than one row is ever
      // simultaneously 'playing' (shouldn't happen given the transactional
      // advance, but a defined pick beats an arbitrary one).
      .order("started_playing_at", { ascending: false })
      .limit(1),
    orderApprovedQueue(supabase.from("song_requests").select(DISPLAY_COLUMNS).eq("status", "approved")).limit(1),
  ]);

  if (playingResult.error || nextResult.error) {
    throw playingResult.error ?? nextResult.error;
  }

  return {
    playing: (playingResult.data?.[0] as DisplaySong | undefined) ?? null,
    next: (nextResult.data?.[0] as DisplaySong | undefined) ?? null,
  };
}

export async function getDisplayQueue(): Promise<DisplayQueue> {
  return fetchDisplayQueue(createAnonServerClient());
}
