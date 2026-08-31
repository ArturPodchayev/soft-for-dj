"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { DisplayQueue } from "@/lib/displayQueue";
import { useRealtimeDisplayQueue } from "@/lib/useRealtimeDisplayQueue";
import { useVerifiedThumbnailUrl } from "@/lib/useVerifiedThumbnail";
import { getSongThumbnailUrl } from "@/lib/albumArt";
import DjViewQueue from "./DjViewQueue";

// Upper bound on how long "Переключаем…" stays disabled after a tap, in
// case Realtime never delivers a confirming update (a dropped WebSocket,
// the RPC silently no-op'ing on a race — see queueActions.ts's "race"
// outcome). The button re-enables the instant real data arrives regardless
// (see the effect below) — this is only the fallback for when it doesn't.
const ADVANCE_TIMEOUT_MS = 5000;

// MM:SS, always non-negative — "00:00" once the track has run past its known
// duration rather than counting into the negatives (a DJ reads "00:00" as
// "should be wrapping up," not as a bug).
function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// The DJ's working screen (TZ Module 5) — sits next to Serato on the same
// laptop, either a narrow window or full-screen on a phone/tablet propped
// beside the controller. Deliberately NOT built like /display
// (DisplayScreen.tsx): no WebGL background, no vinyl spin, no venue
// branding, no fixed 1920x1080 design canvas — this is a glanceable status
// panel a DJ reads peripherally while hands stay on the controller, not a
// projector showpiece. Plain flex stacking + Tailwind breakpoints is
// enough to read equally well in a half-laptop-screen window and a
// full-screen phone in portrait or landscape, which a fixed design canvas
// (scaled as one rigid unit) is specifically the wrong tool for here.
//
// Realtime + anti-flicker come from the same shared hook /display uses
// (lib/useRealtimeDisplayQueue.ts) — one source of truth for "what's
// playing/next," not a second implementation that could drift from it.
export default function DjView({ initialData }: { initialData: DisplayQueue }) {
  const data = useRealtimeDisplayQueue(initialData);
  const thumbnailUrl = useVerifiedThumbnailUrl(getSongThumbnailUrl(data.playing));

  // Deliberately just a boolean, per the brief — the DJ needs "can I cue
  // this up" at a glance, not download_status's full state machine
  // (searching/downloading/needs_review/failed all read the same here:
  // not ready yet). flagged_for_review, error reasons, etc. are an
  // admin/moderator concern (see DownloadStatusBadge), not this screen's.
  const nextReady = data.next?.download_status === "ready";

  // Countdown to the end of the current track. Ticks locally on a plain
  // setInterval — NOT re-derived from Realtime on every second, since
  // Realtime only ever fires on an actual row change (a new track starting),
  // which lands here as new started_playing_at/duration_seconds and simply
  // restarts the effect below. Date.now() is only ever read inside a
  // setInterval/setTimeout callback, never during render or synchronously in
  // the effect body itself — react-hooks' purity rule forbids the former
  // (render must be a pure function of props/state) and its
  // set-state-in-effect rule forbids the latter (a setState call that isn't
  // inside some callback-from-an-external-system is a cascading-render risk)
  // — so even the "reset to null" branch below fires from a deferred
  // setTimeout(…, 0), not a direct call.
  const playingStartedAt = data.playing?.started_playing_at ?? null;
  const playingDuration = data.playing?.duration_seconds ?? null;
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!playingStartedAt || playingDuration == null) {
      const id = setTimeout(() => setRemainingSeconds(null), 0);
      return () => clearTimeout(id);
    }
    const startedMs = new Date(playingStartedAt).getTime();
    const tick = () => setRemainingSeconds(playingDuration - (Date.now() - startedMs) / 1000);
    const interval = setInterval(tick, 1000);
    const initial = setTimeout(tick, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [playingStartedAt, playingDuration]);

  // Disabled the instant a tap fires, re-enabled the instant Realtime
  // delivers ANY change to what's playing/next (not necessarily caused by
  // this tap — any fresh read means the button's stale-data concern is
  // resolved either way), or after ADVANCE_TIMEOUT_MS, whichever comes
  // first. That's what stops a fast double-tap from firing the RPC twice
  // before the first call's effect is visible on screen (requirement: no
  // confirmation dialog, so this debounce is the only guard).
  const [advancing, setAdvancing] = useState(false);
  const stateKey = `${data.playing?.song_title ?? ""}::${data.playing?.artist_name ?? ""}|${data.next?.song_title ?? ""}::${data.next?.artist_name ?? ""}`;
  const prevStateKeyRef = useRef(stateKey);

  useEffect(() => {
    if (advancing && stateKey !== prevStateKeyRef.current) {
      setAdvancing(false);
    }
    prevStateKeyRef.current = stateKey;
  }, [stateKey, advancing]);

  useEffect(() => {
    if (!advancing) return;
    const timeout = setTimeout(() => setAdvancing(false), ADVANCE_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [advancing]);

  async function handleAdvance() {
    // No next track: nothing to advance TO — advance_playing_track(null)
    // would still atomically retire the current track with nothing to
    // replace it, which is a real, valid RPC call, but not what an empty
    // queue's disabled button should ever trigger (see the brief).
    if (!data.next || advancing) return;
    setAdvancing(true);
    try {
      await fetch("/api/admin/queue/next", { method: "POST" });
    } catch {
      // Realtime (or the timeout above) reconciles the button regardless
      // of a network hiccup on this particular request.
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center gap-8 bg-black px-5 py-10 text-white sm:gap-12 sm:px-12">
      <section>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 sm:text-base">Сейчас играет</p>

          {remainingSeconds !== null && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-white sm:px-4 sm:py-2 sm:text-2xl">
              {formatCountdown(remainingSeconds)}
            </span>
          )}
        </div>

        {data.playing ? (
          <div className="mt-4 flex items-center gap-5 sm:mt-6 sm:gap-8">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 sm:h-32 sm:w-32">
              {thumbnailUrl && (
                <Image src={thumbnailUrl} alt="" fill sizes="128px" className="object-cover" unoptimized />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-3xl font-bold leading-tight sm:text-6xl">{data.playing.song_title}</p>
              <p className="mt-1 truncate text-xl text-white/70 sm:mt-2 sm:text-3xl">{data.playing.artist_name}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-2xl text-white/50 sm:mt-6 sm:text-4xl">Ничего не играет</p>
        )}
      </section>

      <div className="h-px w-full bg-white/10" />

      <section>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 sm:text-base">Далее</p>

          {data.next && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide sm:px-4 sm:py-2 sm:text-sm ${
                nextReady ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${nextReady ? "bg-emerald-400" : "bg-red-400"}`} />
              {nextReady ? "Готов" : "Не готов"}
            </span>
          )}
        </div>

        {data.next ? (
          <div className="mt-4 sm:mt-6">
            <p className="truncate text-2xl font-bold leading-tight sm:text-5xl">{data.next.song_title}</p>
            <p className="mt-1 truncate text-lg text-white/70 sm:mt-2 sm:text-2xl">{data.next.artist_name}</p>
          </div>
        ) : (
          <p className="mt-4 text-xl text-white/50 sm:mt-6 sm:text-3xl">Очередь пуста</p>
        )}
      </section>

      {/* Deliberately always enabled regardless of nextReady (🟢/🔴) — a
          DJ choosing to cue up a not-yet-downloaded track is their call,
          not something to block here. Only two things disable it: no next
          track to advance to at all (data.next null), or the brief window
          right after a tap while waiting for Realtime to confirm it (see
          the advancing state above) — both covered by the same
          `disabled` expression, no separate visual treatment needed since
          the label text already says which one it is. */}
      <button
        type="button"
        onClick={handleAdvance}
        disabled={!data.next || advancing}
        className={`w-full rounded-3xl py-6 text-2xl font-bold uppercase tracking-wide transition-all sm:py-8 sm:text-4xl ${
          advancing ? "scale-[0.98] bg-white/20 text-white/50" : "bg-white text-black active:scale-[0.98] disabled:bg-white/10 disabled:text-white/30"
        }`}
      >
        {advancing ? "Переключаем…" : data.next ? "Переключить" : "Очередь пуста"}
      </button>

      {/* Below the advance button, deliberately — that button is the one
          thing this screen needs to stay first-visible and easy to tap
          one-handed next to the controller; the full reorderable queue is
          secondary, scrolled to. */}
      <DjViewQueue />
    </div>
  );
}
