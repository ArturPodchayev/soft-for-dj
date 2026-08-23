import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { orderApprovedQueue } from "@/lib/queue";

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const [playingResult, upNextResult] = await Promise.all([
      supabase
        .from("song_requests")
        .select("*")
        .eq("status", "playing")
        .order("started_playing_at", { ascending: false })
        .limit(1),
      // Same order advanceQueue() picks its next track by — see
      // orderApprovedQueue's docblock for why that matters: this list IS
      // the promise of what plays next.
      orderApprovedQueue(supabase.from("song_requests").select("*").eq("status", "approved")),
    ]);

    if (playingResult.error || upNextResult.error) {
      console.error("Failed to load queue", playingResult.error ?? upNextResult.error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    return NextResponse.json({
      playing: playingResult.data?.[0] ?? null,
      upNext: upNextResult.data ?? [],
    });
  } catch (err) {
    console.error("api/admin/queue: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
