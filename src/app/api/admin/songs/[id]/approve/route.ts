import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { nextQueuePosition } from "@/lib/queue";
import { searchItunesTrackInfo } from "@/lib/itunes";
import { normalizeSongQuery } from "@/lib/deepseek";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { durationSeconds, youtubeUrl } = (body ?? {}) as {
    durationSeconds?: number | null;
    youtubeUrl?: string | null;
  };

  try {
    const supabase = createServiceRoleClient();

    // Needed to search iTunes — the row's own artist/title, not anything
    // from the request body. Read-only, no status guard here: the update
    // below re-checks status='pending' atomically, so a race just means
    // this lookup's result quietly goes unused.
    const { data: existing } = await supabase
      .from("song_requests")
      .select("artist_name, song_title")
      .eq("id", id)
      .maybeSingle();

    const albumArt = existing
      ? await searchItunesTrackInfo(
          await normalizeSongQuery(existing.song_title, existing.artist_name),
          existing.artist_name,
          existing.song_title
        )
      : { artworkUrl: null, durationSeconds: null };

    const queuePosition = await nextQueuePosition(supabase);
    const { data, error } = await supabase
      .from("song_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        queue_position: queuePosition,
        ...(albumArt.artworkUrl ? { album_art_url: albumArt.artworkUrl } : {}),
        ...(typeof durationSeconds === "number"
          ? { duration_seconds: durationSeconds }
          : albumArt.durationSeconds != null
            ? { duration_seconds: albumArt.durationSeconds }
            : {}),
        ...(youtubeUrl ? { youtube_url: youtubeUrl } : {}),
      })
      // Only a still-pending request can be approved — guards against a
      // double-click racing the same row.
      .eq("id", id)
      .eq("status", "pending")
      .select();

    if (error) {
      console.error("Failed to approve song", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Заявка больше не на модерации" }, { status: 409 });
    }

    return NextResponse.json({ song: data[0] });
  } catch (err) {
    console.error("api/admin/songs/[id]/approve: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
