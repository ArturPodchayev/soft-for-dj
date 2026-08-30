// Ported from src/lib/download/pipeline.ts (the Vercel-hosted version) —
// same shape (pickBestCandidate -> tryConfirm -> per-source loop with a
// grey-zone fallback), adapted in exactly two places: the final "confirmed"
// action is a local atomic file write instead of a Google Drive upload, and
// every DB write goes through the restricted `authenticated`-role client
// (see supabaseAgentClient.ts) touching only the columns
// 0003_local_agent_rls.sql grants it, instead of the server's full
// service-role client. The matching/verification logic itself
// (fuzzyScore/durationMatches/hasUnwantedVersionKeyword/buildFileName) is
// NOT duplicated here — it's imported straight from the same
// src/lib/download/{match,filename}.ts files the server pipeline uses (see
// agent/tsconfig.json's path alias), so a future tuning of e.g.
// FUZZY_CONFIRM_THRESHOLD only ever needs to happen in one place.
import { parseBuffer } from "music-metadata";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FUZZY_CONFIRM_THRESHOLD,
  FUZZY_REJECT_THRESHOLD,
  durationMatches,
  fuzzyScore,
  hasUnwantedVersionKeyword,
} from "@/lib/download/match";
import { buildFileName } from "@/lib/download/filename";
import { createHitmoAdapter } from "@/lib/download/sources/hitmo";
import type { SourceAdapter, SourceCandidate, SourceName } from "@/lib/download/types";
import { writeToWatchFolderAtomic } from "./fileWriter";
import { ui } from "./ui";
import type { AgentSong } from "./types";

// Deliberately NOT importing getSources() from
// src/lib/download/sources/index.ts — that factory hardcodes debug=false
// (Vercel's byte-for-byte-unchanged default, see hitmo.ts) and a timeout
// tuned around Vercel's maxDuration ceiling, neither of which applies here.
// Calling createHitmoAdapter directly (still a real import, not a copy) is
// one line and avoids needing a second parameter threaded through that
// shared factory just for this one caller.
const AGENT_SOURCE_TIMEOUT_MS = 15000;
const AGENT_DEBUG = true;

function getAgentSources(): SourceAdapter[] {
  return [createHitmoAdapter(AGENT_SOURCE_TIMEOUT_MS, AGENT_DEBUG)];
}

type ExpectedSong = { artist_name: string; song_title: string; duration_seconds: number | null };
type Fallback = { source: SourceName; reason: string };

function pickBestCandidate(
  sourceName: SourceName,
  candidates: SourceCandidate[],
  expected: ExpectedSong
): { candidate: SourceCandidate; score: number } | null {
  let best: { candidate: SourceCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    if (hasUnwantedVersionKeyword(expected.song_title, candidate.title)) {
      if (AGENT_DEBUG) {
        console.log("[agent-pipeline-debug] candidate rejected: unwanted version keyword", {
          source: sourceName,
          candidateTitle: candidate.title,
          candidateArtist: candidate.artist,
        });
      }
      continue;
    }

    const score = fuzzyScore(
      { artist: expected.artist_name, title: expected.song_title },
      { artist: candidate.artist, title: candidate.title }
    );

    if (AGENT_DEBUG) {
      console.log("[agent-pipeline-debug] candidate scored", {
        source: sourceName,
        expected: `${expected.artist_name} - ${expected.song_title}`,
        candidate: `${candidate.artist} - ${candidate.title}`,
        score,
        belowRejectThreshold: score < FUZZY_REJECT_THRESHOLD,
      });
    }

    if (score < FUZZY_REJECT_THRESHOLD) continue;
    if (!best || score > best.score) best = { candidate, score };
  }

  if (AGENT_DEBUG) {
    console.log("[agent-pipeline-debug] best candidate", {
      source: sourceName,
      picked: best ? { title: best.candidate.title, artist: best.candidate.artist, score: best.score } : null,
    });
  }

  return best;
}

type ConfirmResult =
  | { kind: "ready"; reason: string; buffer: Buffer; fileName: string }
  | { kind: "needs_review"; reason: string };

async function tryConfirm(
  source: SourceAdapter,
  candidate: SourceCandidate,
  expected: ExpectedSong,
  score: number
): Promise<ConfirmResult> {
  const sourceName = source.name;

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

  const res = await source.download(candidate.downloadUrl);
  if (!res.ok) {
    return { kind: "needs_review", reason: `${sourceName}: сходство ${score.toFixed(2)}, но файл не скачался (HTTP ${res.status})` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (expected.duration_seconds != null) {
    try {
      const metadata = await parseBuffer(buffer, "audio/mpeg");
      const actualSeconds = metadata.format.duration;

      if (AGENT_DEBUG) {
        console.log("[agent-pipeline-debug] duration real check (downloaded file vs expected)", {
          source: sourceName,
          expectedSeconds: expected.duration_seconds,
          actualSeconds,
        });
      }

      if (actualSeconds != null && !durationMatches(expected.duration_seconds, actualSeconds)) {
        return {
          kind: "needs_review",
          reason: `${sourceName}: сходство ${score.toFixed(2)}, но длительность не совпала (ожидали ~${expected.duration_seconds}с, файл ${Math.round(actualSeconds)}с)`,
        };
      }
    } catch (err) {
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

// One song's full search -> verify -> write -> DB-update cycle. Never
// throws for an expected outcome (not found, duration mismatch, download
// error) — those all end in a 'needs_review'/'failed' DB write instead,
// same as the server pipeline. main.ts still wraps the call in try/catch as
// a last-resort net for anything unexpected (a Supabase client error, a
// disk-full on the write, etc.).
export async function processApprovedSong(
  supabase: SupabaseClient,
  song: AgentSong,
  watchFolderPath: string
): Promise<void> {
  ui.searching(song);

  let fallback: Fallback | null = null;

  for (const source of getAgentSources()) {
    try {
      const candidates = await source.search(song.artist_name, song.song_title);
      if (AGENT_DEBUG) {
        console.log("[agent-pipeline-debug] source returned candidates", { source: source.name, count: candidates.length });
      }
      const best = pickBestCandidate(source.name, candidates, song);

      if (!best) continue;

      if (best.score < FUZZY_CONFIRM_THRESHOLD) {
        if (!fallback) {
          fallback = { source: source.name, reason: `${source.name}: сходство ${best.score.toFixed(2)} — не уверены` };
        }
        continue;
      }

      await supabase.from("song_requests").update({ download_status: "downloading" }).eq("id", song.id);

      const result = await tryConfirm(source, best.candidate, song, best.score);

      if (result.kind === "ready") {
        try {
          await writeToWatchFolderAtomic(watchFolderPath, result.fileName, result.buffer);
        } catch (writeErr) {
          // The track itself was fully verified (text + duration) — only
          // the local write failed (folder deleted/renamed mid-event, disk
          // full, permissions). Worth surfacing as its own fallback rather
          // than losing that a real match WAS found, same reasoning as the
          // server pipeline's Drive-upload-failure branch.
          const message = writeErr instanceof Error ? writeErr.message : String(writeErr);
          fallback = { source: source.name, reason: `${result.reason}, но не удалось записать файл в Watch Folder (${message})` };
          continue;
        }

        await supabase
          .from("song_requests")
          .update({
            download_status: "ready",
            download_source: source.name,
            download_match_reason: result.reason,
            file_name: result.fileName,
            flagged_for_review: false,
          })
          .eq("id", song.id);

        ui.ready(song);
        return;
      }

      if (!fallback) fallback = { source: source.name, reason: result.reason };
    } catch (err) {
      ui.sourceError(song, source.name, err);
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
      .eq("id", song.id);
    ui.needsReview(song, fallback.reason);
    return;
  }

  await supabase
    .from("song_requests")
    .update({
      download_status: "failed",
      download_match_reason: "Ничего не найдено ни в одном источнике",
      flagged_for_review: true,
    })
    .eq("id", song.id);
  ui.needsReview(song, "ничего не найдено ни в одном источнике");
}
