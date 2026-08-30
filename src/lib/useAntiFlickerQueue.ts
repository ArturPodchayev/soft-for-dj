"use client";

import { useState } from "react";
import type { DisplayQueue } from "@/lib/displayQueue";

// advance_playing_track() (supabase/migrations/0001_init.sql) already makes
// the "old track -> played, new track -> playing" transition atomic, and
// every screen that uses this reacts via Realtime rather than polling —
// but this stays cheap insurance against any other source of a transient
// "nothing playing" read (a Realtime event landing between two rapid admin
// actions, a reconnect after a dropped WebSocket). A read catching a real
// gap should never be trusted immediately if there's reason to believe a
// track is still or about to be playing.
//
// Two rules, applied to the raw fetched DisplayQueue before anything else
// reads it:
//
// 1. raw.playing === null but raw.next !== null: a track hasn't been
//    promoted to 'playing' yet, but something is clearly queued to become
//    it. Hold whatever was previously displayed as "playing" rather than
//    dropping to null; `next` itself updates live.
// 2. raw.playing === null AND raw.next === null: ambiguous from a single
//    read — could be a genuinely empty queue, or a narrower race. Requires
//    the SAME both-null result twice in a row before actually declaring
//    the queue empty.
//
// A real new `playing` value always wins immediately and resets both rules.
export function useAntiFlickerQueue(raw: DisplayQueue): DisplayQueue {
  const [trackedRaw, setTrackedRaw] = useState(raw);
  const [displayed, setDisplayed] = useState(raw);
  const [consecutiveEmptyReads, setConsecutiveEmptyReads] = useState(0);

  if (raw !== trackedRaw) {
    setTrackedRaw(raw);

    if (raw.playing) {
      setConsecutiveEmptyReads(0);
      setDisplayed(raw);
    } else if (raw.next) {
      setConsecutiveEmptyReads(0);
      setDisplayed({ playing: displayed.playing, next: raw.next });
    } else if (displayed.playing !== null || displayed.next !== null) {
      const nextCount = consecutiveEmptyReads + 1;
      setConsecutiveEmptyReads(nextCount);
      if (nextCount >= 2) {
        setDisplayed({ playing: null, next: null });
      }
      // else: hold once more, wait for confirmation on the next read.
    }
    // else: already empty and raw confirms empty — nothing to do.
  }

  return displayed;
}
