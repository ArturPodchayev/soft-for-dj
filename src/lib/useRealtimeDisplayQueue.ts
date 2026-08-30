"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/client";
import { fetchDisplayQueue, type DisplayQueue } from "@/lib/displayQueue";
import { useAntiFlickerQueue } from "@/lib/useAntiFlickerQueue";

// Realtime, not polling (per this project's brief): subscribes to every
// change on song_requests — RLS still governs what the anon client
// actually receives (see supabase/migrations/0001_init.sql's select
// policy), so a still-pending row's change is never delivered here. Any
// delivered event just triggers a re-run of the single shared query
// (fetchDisplayQueue) rather than trying to apply the raw payload
// incrementally — that's what keeps "what's playing/next" computed
// exactly one way everywhere it's read (see lib/queue.ts's
// orderApprovedQueue docblock for why that discipline matters here).
//
// Shared by every screen that needs "what's playing/next right now" — the
// projector display and the DJ-facing utility view both use this same
// hook, so the subscription/refetch plumbing itself can't drift between
// them the way two independently-written copies eventually would.
export function useRealtimeDisplayQueue(initialData: DisplayQueue): DisplayQueue {
  const [rawData, setRawData] = useState<DisplayQueue>(initialData);
  // Created lazily in the effect below, not via a useRef initializer — that
  // runs during render, including the server's initial render of this
  // client component, and createBrowserClient() throws synchronously if
  // the Supabase env vars aren't set. Deferring to an effect keeps that
  // failure client-only, where it belongs.
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const inFlight = useRef(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlight.current || !supabaseRef.current) return;
    inFlight.current = true;
    const thisRequestId = ++requestId.current;
    try {
      const data = await fetchDisplayQueue(supabaseRef.current);
      if (thisRequestId === requestId.current) {
        setRawData(data);
      }
    } catch {
      // Keep showing the last known state — the next change event will retry.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current ?? createBrowserClient();
    supabaseRef.current = supabase;
    const channel = supabase
      .channel("song_requests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "song_requests" }, () => {
        refresh();
      })
      .subscribe();

    refresh();

    return () => {
      requestId.current += 1;
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return useAntiFlickerQueue(rawData);
}
