import type { SupabaseClient } from "@supabase/supabase-js";
import { orderApprovedQueue } from "@/lib/queue";
import type { SongRequest } from "@/lib/songs";

// Atomically retires whatever's currently 'playing' and, if nextId is
// given, promotes that row to 'playing' — via the advance_playing_track()
// Postgres function (supabase/migrations/0001_init.sql), in one RPC
// call/transaction. See that migration's docblock for the live incident
// (a torn "nothing playing" read on /display) this prevents by construction
// rather than two separate .update() calls ever could.
export async function advancePlayingTrack(
  supabase: SupabaseClient,
  nextId: string | null
): Promise<{ song: SongRequest | null; error: string | null }> {
  const { data, error } = await supabase.rpc("advance_playing_track", { p_next_id: nextId });

  if (error) {
    return { song: null, error: error.message };
  }

  return { song: (data as SongRequest[] | null)?.[0] ?? null, error: null };
}

export type AdvanceQueueResult =
  | { status: "advanced"; playing: SongRequest }
  | { status: "empty" } // nothing playing and nothing to advance to
  | { status: "race" } // a next track was picked but lost the race to claim it
  | { status: "error"; message: string };

// The one place "move the queue forward" is decided: current playing (if
// any) -> played, then whichever approved row is first in
// orderApprovedQueue's order. Used by the moderator's "Next" button
// (app/api/admin/queue/next).
export async function advanceQueue(supabase: SupabaseClient): Promise<AdvanceQueueResult> {
  const { data: next, error: nextError } = await orderApprovedQueue(
    supabase.from("song_requests").select("id").eq("status", "approved")
  ).limit(1);

  if (nextError) {
    return { status: "error", message: nextError.message };
  }

  const nextId: string | null = next?.[0]?.id ?? null;

  const { song, error } = await advancePlayingTrack(supabase, nextId);
  if (error) {
    return { status: "error", message: error };
  }

  if (!nextId) {
    return { status: "empty" };
  }
  if (!song) {
    return { status: "race" };
  }

  return { status: "advanced", playing: song };
}
