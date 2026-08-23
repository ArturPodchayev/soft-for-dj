import type { SupabaseClient } from "@supabase/supabase-js";

// The one ORDER for "the approved queue, in play order." Every caller that
// needs "what's next" or "the up-next list" must apply this to its own
// .eq("status", "approved") query rather than writing its own .order()
// calls.
//
// This isn't a hypothetical concern: aut-dj-party shipped with two
// different implementations of "queue order" — one in the admin queue read,
// one in the advance-to-next-track logic — and they silently disagreed
// under a specific mix of manually-reordered and freshly-approved rows,
// playing a track out of the order the moderator saw on screen. Routing
// every caller through this single function is what makes that class of bug
// impossible to reintroduce (see for-claude/prompt_for_claude_code.md).
//
// Generic over the caller's own already-built query rather than owning the
// initial `.select()` — keeps this composable with whatever columns/filters
// the caller already needs, and avoids fighting Supabase's own already
// elaborate query-builder type inference with a second generic parameter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural constraint on Supabase's overloaded .order()
export function orderApprovedQueue<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: true });
}

// Next slot at the end of the approved queue. Read-then-write (not
// transactional) — acceptable at this app's scale (one moderator clicking
// Approve during one event); a collision just leaves two rows with the same
// position, which the queue's submitted_at tiebreak tolerates fine.
export async function nextQueuePosition(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("song_requests")
    .select("queue_position")
    .in("status", ["approved", "playing"])
    .order("queue_position", { ascending: false, nullsFirst: false })
    .limit(1);

  return (data?.[0]?.queue_position ?? 0) + 1;
}
