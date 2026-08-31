"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

// Shared by components/admin/UpNextQueue.tsx (/admin) and
// components/djview/DjViewQueue.tsx (/dj-view) — both render the same
// up-next queue with the same drag-to-reorder interaction against the same
// POST /api/admin/queue/reorder endpoint. One implementation here, so a
// future fix to the rollback/error handling can't quietly diverge between
// the two screens the way two independently copy-pasted versions could.
//
// Ownership model: this hook owns `items` itself — NOT the caller's own
// server-polled state. A caller feeds a fresh poll result in through
// syncItems(), which is a deliberate no-op for the span of an in-flight
// drag/reorder request (isDragging) — that's what stops a poll landing
// mid-drag from reverting the optimistic order, without the caller having
// to remember to pause its own polling itself. (components/admin/
// QueuePanel.tsx used to own exactly this guard directly, via its own
// isReorderingRef — now redundant and removed now that this hook covers it
// for every caller.)
export type UseReorderableQueueOptions = {
  // Fired once the reorder POST settles — true if it was accepted
  // (queue_position actually persisted), false if it was rejected or the
  // request failed outright (items has already been rolled back to its
  // pre-drag order by the time this fires). Callers use this for their own
  // side effects — e.g. forcing an extra poll on success, or showing an
  // error toast on failure — the hook itself does neither.
  onReorderSettled?: (success: boolean) => void;
};

export type UseReorderableQueueResult<T> = {
  items: T[];
  // Feed a fresh server read in. No-op while a drag/reorder is in flight.
  syncItems: (items: T[]) => void;
  isDragging: boolean;
  // Spread onto <DndContext {...dndContextProps}> — kept as one object
  // (rather than exposing onDragEnd/collisionDetection separately) since
  // every caller wants both together and none has a reason to override
  // just one of them.
  dndContextProps: {
    collisionDetection: typeof closestCenter;
    onDragEnd: (event: DragEndEvent) => void;
  };
};

export function useReorderableQueue<T extends { id: string }>(
  initialItems: T[],
  options?: UseReorderableQueueOptions
): UseReorderableQueueResult<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  // Guards the same kind of race a poll's own requestId always has: if a
  // second drag were to start before the first drag's POST has resolved,
  // only the most recent one's response may flip isDragging back off or
  // roll `items` back — an earlier, now-superseded response landing late
  // must not stomp on whatever the newer drag already did.
  const requestId = useRef(0);
  // Read inside the fetch .then()/.catch() below, which can fire long after
  // the render that scheduled them — a ref keeps `options` current without
  // forcing handleDragEnd (and therefore dndContextProps) to change
  // identity every render just because the caller passed a fresh inline
  // callback.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const syncItems = useCallback((next: T[]) => {
    if (isDraggingRef.current) return;
    setItems(next);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;

      const previousOrder = current;
      const reordered = arrayMove(current, oldIndex, newIndex);

      // Optimistic: the drop is reflected on screen immediately, before the
      // network round trip — the alternative (waiting for the next poll)
      // would make every drag look like it silently did nothing until then.
      isDraggingRef.current = true;
      setIsDragging(true);
      const thisRequestId = ++requestId.current;

      fetch("/api/admin/queue/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: reordered.map((item) => item.id) }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`reorder failed (${res.status})`);
          if (thisRequestId === requestId.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
          }
          optionsRef.current?.onReorderSettled?.(true);
        })
        .catch(() => {
          // Someone else changed the queue mid-drag (played/rejected one of
          // the dragged tracks) or the request itself failed outright — roll
          // back to exactly what was on screen before this drag rather than
          // leave a local order the server never actually applied.
          if (thisRequestId === requestId.current) {
            setItems(previousOrder);
            isDraggingRef.current = false;
            setIsDragging(false);
          }
          optionsRef.current?.onReorderSettled?.(false);
        });

      return reordered;
    });
  }, []);

  return {
    items,
    syncItems,
    isDragging,
    dndContextProps: { collisionDetection: closestCenter, onDragEnd: handleDragEnd },
  };
}
