import { createInterface } from "node:readline/promises";
import { loadOrPromptConfig } from "./config";
import { createSignedInAgentClient } from "./supabaseAgentClient";
import { processApprovedSong } from "./pipeline";
import { ui } from "./ui";
import type { AgentSong } from "./types";

// download_status values that mean "the agent hasn't produced a result for
// this row yet." 'searching' is what approve/route.ts sets synchronously on
// every approval (see that route's DEPRECATED comment) — the normal case.
// 'not_started' is a defensive inclusion for any row that somehow reached
// 'approved' without that write (shouldn't happen, costs nothing to also
// catch). 'downloading' is included ONLY in the startup catch-up set below,
// not the live one — see handleRealtimeChange()'s docblock for why.
// 'needs_review'/'failed' are deliberately excluded from both: those are
// terminal outcomes the admin's manual fallback (TrackQuickActions) owns
// from here, same as before this agent existed.
const LIVE_ELIGIBLE_STATUSES = new Set(["searching", "not_started"]);
const STARTUP_ELIGIBLE_STATUSES = new Set([...LIVE_ELIGIBLE_STATUSES, "downloading"]);

// Deliberately NOT `phone` — the restricted `authenticated` role's SELECT
// grant (0003_local_agent_rls.sql) doesn't even allow selecting it, but
// listing exactly what's needed here is the actual guarantee: this agent's
// own code never asks for, logs, or touches a guest's phone number.
const SELECT_COLUMNS = "id, song_title, artist_name, duration_seconds, status, download_status";

async function main(): Promise<void> {
  const config = await loadOrPromptConfig();
  const supabase = await createSignedInAgentClient(config);

  // Song IDs this process is currently downloading — guards against
  // reprocessing our own writes. Our 'downloading'/'ready'/'needs_review'
  // update below comes back over the SAME Realtime subscription (it matches
  // `status=eq.approved` too, status never changes during a download), so
  // without this an id would be picked up again the instant we touch it.
  const inFlight = new Set<string>();

  async function process(song: AgentSong, eligible: Set<string>): Promise<void> {
    if (!eligible.has(song.download_status) || inFlight.has(song.id)) return;
    inFlight.add(song.id);
    try {
      await processApprovedSong(supabase, song, config.watchFolderPath);
    } catch (err) {
      ui.sourceError(song, "pipeline", err);
    } finally {
      inFlight.delete(song.id);
    }
  }

  // Realtime only ever tells us WHICH row changed (payload.new) — never
  // used as the actual data source. Re-fetching via the same restricted
  // client both re-confirms status='approved' hasn't moved on since the
  // event fired, and guarantees the only columns this agent ever acts on
  // are the ones 0003_local_agent_rls.sql's column grant actually allows,
  // rather than trusting whatever Realtime's replication payload happens to
  // contain (Realtime's row-level filtering follows the SELECT RLS policy,
  // but the WAL-sourced payload itself isn't filtered by column-level
  // grants the way a REST .select() is).
  async function handleRealtimeChange(id: string): Promise<void> {
    if (inFlight.has(id)) return;
    const { data: song, error } = await supabase
      .from("song_requests")
      .select(SELECT_COLUMNS)
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) {
      ui.fatal(`Не удалось перечитать заявку ${id} после Realtime-события: ${error.message}`);
      return;
    }
    if (!song) return;
    await process(song as AgentSong, LIVE_ELIGIBLE_STATUSES);
  }

  // 1. Catch-up — rows that became eligible while the agent was off, per
  // the brief: never rely on Realtime alone for "what needs doing right
  // now." Also the one place 'downloading' is eligible, for self-healing
  // after a crash mid-download in a previous run (nothing else will ever
  // move such a row forward otherwise).
  const { data: pending, error: catchUpError } = await supabase
    .from("song_requests")
    .select(SELECT_COLUMNS)
    .eq("status", "approved")
    .in("download_status", [...STARTUP_ELIGIBLE_STATUSES]);

  if (catchUpError) {
    ui.fatal(`Не удалось прочитать необработанные заявки при старте: ${catchUpError.message}`);
  } else {
    ui.catchUp(pending?.length ?? 0);
    for (const song of (pending ?? []) as AgentSong[]) {
      void process(song, STARTUP_ELIGIBLE_STATUSES);
    }
  }

  // 2. Realtime — everything that happens from now on. Supabase Realtime's
  // postgres_changes filter only supports a single simple column filter, so
  // status=eq.approved is as far as it goes server-side; download_status is
  // re-checked above, after the re-fetch.
  supabase
    .channel("agent-approved-songs")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "song_requests", filter: "status=eq.approved" },
      (payload) => {
        const id = (payload.new as { id?: string } | null)?.id;
        if (id) void handleRealtimeChange(id);
      }
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        ui.connected();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        ui.realtimeStatus(status, err);
      }
    });

  // Deliberately no explicit "wait forever" here: the open Realtime
  // WebSocket (and supabase-js's own token-refresh timer) already keep the
  // Node event loop alive, which is what actually keeps this console window
  // open until the DJ closes it themselves, per the brief.
}

// A double-clicked .exe's console window closes the instant the process
// exits — on Windows, immediately, before anyone could read a crash
// message. This is the one path where the process legitimately does exit
// (loadOrPromptConfig/createSignedInAgentClient/the catch-up query all
// throw on a real setup problem), so it's the one place worth pausing for a
// keypress first.
async function pauseBeforeExit(): Promise<void> {
  try {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("\nНажми Enter, чтобы закрыть окно...");
    rl.close();
  } catch {
    // stdin isn't interactive (e.g. launched from some automated context) —
    // nothing more useful to do than just exit.
  }
}

main().catch(async (err) => {
  ui.fatal(err instanceof Error ? err.message : String(err));
  await pauseBeforeExit();
  process.exitCode = 1;
});
