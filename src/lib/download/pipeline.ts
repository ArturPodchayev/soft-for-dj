import { parseBuffer } from "music-metadata";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchWithTimeout } from "@/lib/http";
import { getSources, SOURCE_TIMEOUT_MS } from "@/lib/download/sources";
import {
  FUZZY_CONFIRM_THRESHOLD,
  FUZZY_REJECT_THRESHOLD,
  durationMatches,
  fuzzyScore,
  hasUnwantedVersionKeyword,
} from "@/lib/download/match";
import { buildFileName } from "@/lib/download/filename";
import { uploadToDrive } from "@/lib/download/googleDrive";
import type { SourceCandidate, SourceName } from "@/lib/download/types";

type ExpectedSong = { artist_name: string; song_title: string; duration_seconds: number | null };
type Fallback = { source: SourceName; reason: string };

function pickBestCandidate(
  candidates: SourceCandidate[],
  expected: ExpectedSong
): { candidate: SourceCandidate; score: number } | null {
  let best: { candidate: SourceCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    // Checked before any scoring/downloading — a remix/cover/live/
    // instrumental result the guest didn't ask for is disqualified purely
    // from its title text, no fuzzy score or network request needed.
    if (hasUnwantedVersionKeyword(expected.song_title, candidate.title)) continue;

    const score = fuzzyScore(
      { artist: expected.artist_name, title: expected.song_title },
      { artist: candidate.artist, title: candidate.title }
    );
    if (score < FUZZY_REJECT_THRESHOLD) continue;
    if (!best || score > best.score) best = { candidate, score };
  }

  return best;
}

type ConfirmResult =
  | { kind: "ready"; reason: string; buffer: Buffer; fileName: string }
  | { kind: "needs_review"; reason: string };

// Downloads the candidate's audio file into memory and checks its real
// duration against the request's expected duration (from the iTunes lookup
// already run on approve — see the approve route). Only called once the
// candidate has already cleared FUZZY_CONFIRM_THRESHOLD on title text
// alone; this is the final check before trusting it enough to upload.
async function tryConfirm(
  sourceName: SourceName,
  candidate: SourceCandidate,
  expected: ExpectedSong,
  score: number
): Promise<ConfirmResult> {
  // Cheap pre-check on the source's own listed duration, before spending a
  // multi-MB download on a candidate that's already ruled out by it. Not a
  // substitute for the real check below (a source's listed duration is
  // occasionally wrong/stale) — just skips the network round trip when it
  // doesn't need to happen.
  if (
    candidate.durationSeconds != null &&
    expected.duration_seconds != null &&
    !durationMatches(expected.duration_seconds, candidate.durationSeconds)
  ) {
    return {
      kind: "needs_review",
      reason: `${sourceName}: сходство ${score.toFixed(2)}, но заявленная длительность не совпала (ожидали ~${expected.duration_seconds}с, у источника ${candidate.durationSeconds}с)`,
    };
  }

  const res = await fetchWithTimeout(candidate.downloadUrl, {}, SOURCE_TIMEOUT_MS);
  if (!res.ok) {
    return { kind: "needs_review", reason: `${sourceName}: сходство ${score.toFixed(2)}, но файл не скачался (HTTP ${res.status})` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (expected.duration_seconds != null) {
    try {
      const metadata = await parseBuffer(buffer, "audio/mpeg");
      const actualSeconds = metadata.format.duration;
      if (actualSeconds != null && !durationMatches(expected.duration_seconds, actualSeconds)) {
        return {
          kind: "needs_review",
          reason: `${sourceName}: сходство ${score.toFixed(2)}, но длительность не совпала (ожидали ~${expected.duration_seconds}с, файл ${Math.round(actualSeconds)}с)`,
        };
      }
    } catch (err) {
      // Can't verify duration from a file that doesn't parse as audio —
      // treat as inconclusive rather than confirmed.
      return {
        kind: "needs_review",
        reason: `${sourceName}: сходство ${score.toFixed(2)}, но не удалось прочитать метаданные файла (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }

  return {
    kind: "ready",
    reason: `${sourceName}: сходство ${score.toFixed(2)}${expected.duration_seconds != null ? ", длительность совпала" : ""}`,
    buffer,
    fileName: buildFileName(expected.artist_name, expected.song_title),
  };
}

// Module 4's entry point — triggered from the approve route via next/server's
// after(), so it runs after the moderator's response has already been sent
// (see that route for why). Tries each configured source in priority order
// (src/lib/download/sources/index.ts), stopping at the first CONFIRMED
// match; falls back to the best grey-zone candidate seen across all
// sources if nothing was confirmed; marks 'failed' if nothing usable was
// found anywhere.
export async function runDownloadPipeline(songId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: song, error: fetchError } = await supabase
    .from("song_requests")
    .select("artist_name, song_title, duration_seconds")
    .eq("id", songId)
    .maybeSingle();

  if (fetchError || !song) {
    console.error("download-pipeline: could not load song", { songId, error: fetchError?.message });
    return;
  }

  console.log("download-pipeline: starting", { songId, artist: song.artist_name, title: song.song_title });

  let fallback: Fallback | null = null;

  for (const source of getSources()) {
    try {
      const candidates = await source.search(song.artist_name, song.song_title);
      const best = pickBestCandidate(candidates, song);

      if (!best) {
        console.log("download-pipeline: no usable candidate", { songId, source: source.name });
        continue;
      }

      if (best.score < FUZZY_CONFIRM_THRESHOLD) {
        console.log("download-pipeline: grey-zone candidate", { songId, source: source.name, score: best.score });
        if (!fallback) {
          fallback = { source: source.name, reason: `${source.name}: сходство ${best.score.toFixed(2)} — не уверены` };
        }
        continue;
      }

      await supabase.from("song_requests").update({ download_status: "downloading" }).eq("id", songId);

      const result = await tryConfirm(source.name, best.candidate, song, best.score);

      if (result.kind === "ready") {
        console.log("download-pipeline: confirmed, uploading to Drive", { songId, source: source.name });
        try {
          const upload = await uploadToDrive(result.buffer, result.fileName);
          await supabase
            .from("song_requests")
            .update({
              download_status: "ready",
              download_source: source.name,
              download_match_reason: result.reason,
              drive_file_id: upload.fileId,
              drive_file_url: upload.fileUrl,
              file_name: result.fileName,
              flagged_for_review: false,
            })
            .eq("id", songId);
          console.log("download-pipeline: ready", { songId, source: source.name });
          return;
        } catch (uploadErr) {
          // The track itself was fully verified (text + duration) — only
          // the Drive upload failed (missing/invalid credentials, quota,
          // network). That's worth surfacing as its own fallback rather
          // than falling through to the generic catch below and losing the
          // fact that a real match WAS found, in case no other source does
          // better. Not returned immediately: a later source could still
          // yield a real 'ready' if this was a one-off upload hiccup.
          const message = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          console.error("download-pipeline: Drive upload failed", { songId, source: source.name, message });
          fallback = { source: source.name, reason: `${result.reason}, но не удалось загрузить в Google Drive (${message})` };
          continue;
        }
      }

      console.log("download-pipeline: downgraded to needs_review", { songId, source: source.name, reason: result.reason });
      if (!fallback) fallback = { source: source.name, reason: result.reason };
    } catch (err) {
      console.error("download-pipeline: source failed", {
        songId,
        source: source.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (fallback) {
    await supabase
      .from("song_requests")
      .update({
        download_status: "needs_review",
        download_source: fallback.source,
        download_match_reason: fallback.reason,
        flagged_for_review: true,
      })
      .eq("id", songId);
    console.log("download-pipeline: needs_review (no confirmed match)", { songId, reason: fallback.reason });
    return;
  }

  await supabase
    .from("song_requests")
    .update({
      download_status: "failed",
      download_match_reason: "Ничего не найдено ни в одном источнике",
      flagged_for_review: true,
    })
    .eq("id", songId);
  console.log("download-pipeline: failed, nothing found", { songId });
}
