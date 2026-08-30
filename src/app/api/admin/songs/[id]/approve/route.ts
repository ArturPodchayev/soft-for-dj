import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { nextQueuePosition } from "@/lib/queue";
import { searchItunesTrackInfo } from "@/lib/itunes";
import { normalizeSongQuery } from "@/lib/deepseek";

// NOTE: this route used to also import `after` (next/server) and
// runDownloadPipeline (@/lib/download/pipeline) to trigger Module 4's
// search/verify/upload pipeline right after approval — see the DEPRECATED
// comment below (where that call used to be) for why that's disabled now,
// and a `maxDuration` export here (it existed specifically to give that
// background work Vercel execution time beyond the response). Everything
// this route does now is a single fast Postgres round trip — no export
// needed for that.

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

    // DEPRECATED (2026-08-31, confirmed with the user): this used to trigger
    // Module 4's search/verify/upload pipeline (runDownloadPipeline) here via
    // next/server's after(), right after approval. Left disabled, not
    // deleted — runDownloadPipeline/googleDrive.ts/the Cloudflare Worker
    // proxy all still exist, just unused now. Reason: Hitmo durably blocks
    // Vercel's egress IPs (see sources/index.ts's 2026-08-30 writeup) but not
    // an ordinary residential IP, so the download step moved to a local
    // agent (agent/) running on the DJ's own laptop — it picks up newly
    // 'approved' rows via Supabase Realtime (see agent/src/pipeline.ts)
    // instead of being triggered from this route. Re-enabling this call
    // would race the agent: both would try to own the same row's
    // download_status, and the server pipeline losing that race would
    // overwrite a real 'ready' (file already sitting in the DJ's Watch
    // Folder) back to 'needs_review'/'failed'. download_status: 'searching'
    // above still happens synchronously in this same request either way —
    // that's the signal the agent's catch-up query and Realtime subscription
    // both watch for.
    //
    // after(() => runDownloadPipeline(id).catch((err) => console.error("download-pipeline: uncaught error", { id, message: err instanceof Error ? err.message : String(err) })));

    return NextResponse.json({ song: data[0] });
  } catch (err) {
    console.error("api/admin/songs/[id]/approve: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
