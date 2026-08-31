"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SongRequest } from "@/lib/songs";
import NowPlaying from "./NowPlaying";
import UpNextQueue from "./UpNextQueue";

// Approved/playing rows are readable by the anon key, but this panel also
// needs the authenticated service-role route regardless (queue_position
// isn't exposed to anon reads), so it polls the one consistent data path —
// see components/admin/PendingFeed.tsx for the same reasoning.
const POLL_INTERVAL_MS = 3500;

export default function QueuePanel() {
  const [playing, setPlaying] = useState<SongRequest | null>(null);
  const [upNext, setUpNext] = useState<SongRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);
  // Bumped on every fetchQueue() call and on Advance's own confirmed write
  // below. A GET response only gets applied if it's still the most recent
  // thing asked for — otherwise a poll already in flight when the
  // moderator clicked Advance could resolve afterwards with pre-advance
  // data and silently revert it.
  const requestId = useRef(0);
  // True for the span of a drag-and-drop reorder in UpNextQueue — from the
  // optimistic local update through the POST /api/admin/queue/reorder
  // response. A ref (not state): fetchQueue reads it on every poll tick via
  // a plain closure check, not as a render dependency — using state here
  // would mean either re-subscribing the poll interval on every
  // start/stop (drifting its cadence) or a stale closure missing the
  // latest value.
  const isReorderingRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    // A poll landing mid-drag (or while the reorder's own POST is still in
    // flight) would otherwise overwrite the optimistic order UpNextQueue
    // just applied with the stale pre-drag data — this is the "pause
    // polling during a reorder" the brief asks for, done as a no-op guard
    // rather than actually clearing/resetting the interval timer.
    if (isReorderingRef.current) return;
    const thisRequestId = ++requestId.current;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/queue", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (thisRequestId === requestId.current) {
        setPlaying(data.playing);
        setUpNext(data.upNext);
        setLoaded(true);
      }
    } catch {
      // Keep showing the last known state — the next poll will retry.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchQueue, 0);
    const interval = setInterval(fetchQueue, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchQueue]);

  async function handleAdvance() {
    const res = await fetch("/api/admin/queue/next", { method: "POST" });
    if (!res.ok && res.status !== 409) throw new Error("Advance failed");
    if (res.ok) {
      const data = await res.json();
      requestId.current += 1;
      setPlaying(data.playing ?? null);
    }
    await fetchQueue();
  }

  // Called synchronously by UpNextQueue the instant a drag drops — before
  // its own optimistic setUpNext, so no in-flight poll can land afterwards
  // and revert it (see fetchQueue's isReorderingRef guard above; bumping
  // requestId here also invalidates a GET that was already in flight the
  // moment the drag ended, same pattern as handleAdvance's own bump).
  function handleReorderStart() {
    isReorderingRef.current = true;
    requestId.current += 1;
  }

  // success=true: the reorder actually persisted — force exactly one
  // fetchQueue() to pick up submitted_at tiebreaks or anything else that
  // changed server-side during the drag; its own requestId guard still
  // applies, so this only ever wins if nothing newer has been asked for
  // since. success=false: UpNextQueue already rolled its local state back
  // itself, polling just needs to resume.
  async function handleReorderEnd(success: boolean) {
    isReorderingRef.current = false;
    if (success) await fetchQueue();
  }

  if (!loaded) {
    return (
      <section className="px-6 pt-6">
        <p className="text-brand-fg/60">Загрузка…</p>
      </section>
    );
  }

  return (
    <>
      <NowPlaying playing={playing} onAdvance={handleAdvance} />
      <UpNextQueue
        upNext={upNext}
        setUpNext={setUpNext}
        onReorderStart={handleReorderStart}
        onReorderEnd={handleReorderEnd}
      />
    </>
  );
}
