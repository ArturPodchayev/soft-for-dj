import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { orderApprovedQueue } from "@/lib/queue";

// Drag-and-drop reorder of the up-next queue (UpNextQueue.tsx). One RPC
// call — reorder_queue() (supabase/migrations/0004_reorder_queue.sql) —
// atomically sets queue_position for the given ids in array order, or
// rejects the whole reorder if one no longer matches an approved/playing
// row (played/deleted by someone else mid-drag). No read-then-write here,
// same reasoning as /api/admin/queue/next's advance_playing_track().
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const { songIds } = (body ?? {}) as { songIds?: unknown };
  if (!Array.isArray(songIds) || songIds.length === 0 || songIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ message: "songIds должен быть непустым массивом строк" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error: rpcError } = await supabase.rpc("reorder_queue", { song_ids: songIds });

    if (rpcError) {
      // reorder_queue raises when an id no longer matches an
      // approved/playing row — a real desync (someone else played/rejected
      // one of the dragged tracks a moment earlier), not a server bug. The
      // client's job is to refetch and let the moderator re-drag against
      // the current list, same as Advance's own 409 handling.
      console.warn("api/admin/queue/reorder: reorder_queue rejected", { message: rpcError.message });
      return NextResponse.json({ message: "Очередь изменилась, обновите список" }, { status: 409 });
    }

    // Re-read through the one shared order (not the RPC's own returned
    // rows, which come back in an arbitrary row order) — same query the
    // GET /api/admin/queue route and advanceQueue() use, so the client
    // gets back exactly the list it would see on its next poll anyway,
    // submitted_at tiebreaks included.
    const { data, error: fetchError } = await orderApprovedQueue(
      supabase.from("song_requests").select("*").eq("status", "approved")
    );

    if (fetchError) {
      console.error("api/admin/queue/reorder: failed to reload queue after reorder", fetchError);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    return NextResponse.json({ upNext: data ?? [] });
  } catch (err) {
    console.error("api/admin/queue/reorder: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
