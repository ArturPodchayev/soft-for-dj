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

  const fetchQueue = useCallback(async () => {
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

  // After a successful drag-and-drop reorder (useReorderableQueue, used
  // inside UpNextQueue), force one extra fetchQueue() so this panel picks
  // up submitted_at tiebreaks/any concurrent change sooner than the next
  // POLL_INTERVAL_MS tick — the hook's own isDragging guard
  // (lib/useReorderableQueue.ts) already keeps a poll landing MID-drag from
  // clobbering the optimistic order on its own, so nothing here needs to
  // pause polling itself anymore (it used to, via an isReorderingRef this
  // panel owned directly — redundant now, removed).
  async function handleReorderSettled(success: boolean) {
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
      <UpNextQueue upNext={upNext} onReorderSettled={handleReorderSettled} />
    </>
  );
}
