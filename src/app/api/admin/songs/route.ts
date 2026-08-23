import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Pending rows are deliberately excluded from the anon-key SELECT policy
// (see supabase/migrations/0001_init.sql) so a public visitor on /display
// can never read another guest's name/phone number — true Supabase Realtime
// isn't available here for that reason. Polled through this authenticated,
// service-role route instead (see components/admin/PendingFeed.tsx).
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true });

    if (error) {
      console.error("Failed to load pending songs", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    return NextResponse.json({ songs: data ?? [] });
  } catch (err) {
    console.error("api/admin/songs: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
