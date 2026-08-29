import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// The full song_requests history — every status, not just 'pending' (see
// /api/admin/songs for that narrower feed). Used by the admin "Все заявки"
// audit view; newest first, since that's what a moderator scanning history
// actually wants to see.
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Failed to load all songs", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    return NextResponse.json({ songs: data ?? [] });
  } catch (err) {
    console.error("api/admin/songs/all: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}

// Wipes every song_requests row — the "Удалить всё" button's target.
// Irreversible, and deliberately has no undo: the confirming modal on the
// client (AllRequestsSection.tsx) is the only guard, same as this being a
// destructive admin-only action behind the session cookie proxy.ts already
// enforces on every /api/admin/* path.
//
// .not("id", "is", null) is a real filter (matches every row, since id is
// the primary key and is never null) rather than a no-op — PostgREST
// rejects an entirely unfiltered DELETE as a safety measure, so a filter
// that's unconditionally true is the correct way to say "yes, all of them"
// rather than something to work around.
export async function DELETE() {
  try {
    const supabase = createServiceRoleClient();
    const { error, count } = await supabase
      .from("song_requests")
      .delete({ count: "exact" })
      .not("id", "is", null);

    if (error) {
      console.error("Failed to delete all songs", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  } catch (err) {
    console.error("api/admin/songs/all DELETE: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
