import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { nextQueuePosition } from "@/lib/queue";
import { searchItunesTrackInfo } from "@/lib/itunes";
import { normalizeSongQuery } from "@/lib/deepseek";
import { runDownloadPipeline } from "@/lib/download/pipeline";

// Module 4's autosearch/download pipeline (see runDownloadPipeline) runs
// entirely inside after() below, so its time counts against this route's
// own execution — Vercel keeps the function alive until after() finishes or
// this limit is hit. Next.js requires this export to be a literal (it's
// statically analyzed, not evaluated), so it can't be derived from
// SOURCE_TIMEOUT_MS (src/lib/download/sources/index.ts) directly — keep the
// two in sync by hand if that constant changes. 38s = one source's 8s
// timeout, worst case, plus real download + Drive upload overhead, with
// headroom below Vercel Hobby's 60s ceiling (not butted up against it — a
// single slow step anywhere shouldn't be able to cut the request off
// mid-write). Revisit if more sources are added.
export const maxDuration = 38;

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
        // Set synchronously, in the same write, so the admin UI's next poll
        // already shows "Ищем…" instead of the stale 'not_started' state
        // while it waits for the background pipeline (triggered below) to
        // make its own first write.
        download_status: "searching",
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

    // Runs after this response has been sent to the moderator — Module 4's
    // search/verify/upload pipeline (see runDownloadPipeline) is the slow
    // part of approving a request and must never make the moderator wait
    // on it. Errors are caught inside the pipeline itself (each stage logs
    // and falls back to 'needs_review'/'failed' rather than throwing), so
    // nothing here needs its own .catch — but one is kept as a last-resort
    // net in case the pipeline throws before reaching its own try/catch.
    after(() => runDownloadPipeline(id).catch((err) => console.error("download-pipeline: uncaught error", { id, message: err instanceof Error ? err.message : String(err) })));

    return NextResponse.json({ song: data[0] });
  } catch (err) {
    console.error("api/admin/songs/[id]/approve: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
