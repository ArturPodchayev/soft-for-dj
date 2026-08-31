"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SongRequest } from "@/lib/songs";
import { useReorderableQueue } from "@/lib/useReorderableQueue";

// Same cadence as components/admin/QueuePanel.tsx's own poll of the same
// route — no reason for the two screens to disagree on how fresh "the
// queue" should be.
const POLL_INTERVAL_MS = 3500;

// Same grip glyph as components/admin/UpNextQueue.tsx — kept as its own
// copy rather than a shared component: it's four lines of SVG, and the
// markup around it here (dark/minimal DJ screen) has nothing else in
// common with admin's card-list styling that would make sharing a wrapper
// worthwhile.
function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
      <rect x="2" y="7.2" width="12" height="1.6" rx="0.8" />
      <rect x="2" y="11.4" width="12" height="1.6" rx="0.8" />
    </svg>
  );
}

function SortableQueueRow({ song }: { song: SongRequest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 py-2.5 ${isDragging ? "relative z-10 rounded-xl bg-white/10" : ""}`}
    >
      {/* {...listeners}/{...attributes} live ONLY on this handle — this row
          has no other interactive element to protect from it (no "⋯", no
          edit button, per the brief), but the same scoped-handle pattern is
          kept anyway for consistency with admin's UpNextQueue.tsx. */}
      <button
        type="button"
        aria-label="Перетащить, чтобы изменить порядок"
        {...attributes}
        {...listeners}
        className="shrink-0 touch-none cursor-grab rounded-full p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60 active:cursor-grabbing"
      >
        <GripIcon />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-white sm:text-lg">
          {song.song_title}
          <span className="font-normal text-white/50"> — {song.artist_name}</span>
        </p>
      </div>
    </li>
  );
}

// The up-next queue, on the DJ's own screen — reorder only, nothing to
// read/edit beyond title+artist (no download-status badge, no "⋯" quick
// actions, no requester name — those are an /admin moderation concern, see
// components/admin/UpNextQueue.tsx, deliberately not duplicated here). All
// drag-and-drop mechanics come from the exact same lib/useReorderableQueue.ts
// admin's UpNextQueue.tsx uses — one implementation, two renderings.
//
// Independent of DjView's own useRealtimeDisplayQueue() (see DjView.tsx) —
// that hook, shared with the public /display projector, only ever exposes
// the single "next" row and carries no id/queue_position to reorder
// against, and is deliberately left untouched by this feature. This
// component polls the same authenticated GET /api/admin/queue route
// admin's QueuePanel.tsx already uses instead — /dj-view already sits
// behind the same admin session cookie (see DjViewLogin.tsx), so this needs
// no new authorization of its own.
export default function DjViewQueue() {
  const [upNext, setUpNext] = useState<SongRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);
  const requestId = useRef(0);

  const { items, syncItems, isDragging, dndContextProps } = useReorderableQueue(upNext);

  // isDragging in the dependency array is deliberate here (unlike
  // QueuePanel.tsx's own historical approach): re-subscribing the interval
  // around a drag means it also fires one near-immediate extra poll right
  // after the drag settles (the effect's cleanup+resetup below), which
  // doubles as "refresh soon after a reorder" for free — this screen has no
  // separate onReorderSettled wiring for that the way QueuePanel.tsx does.
  const fetchQueue = useCallback(async () => {
    if (isDragging) return;
    const thisRequestId = ++requestId.current;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/queue", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (thisRequestId === requestId.current) {
        setUpNext(data.upNext ?? []);
        setLoaded(true);
      }
    } catch {
      // Keep showing the last known state — the next poll will retry.
    } finally {
      inFlight.current = false;
    }
  }, [isDragging]);

  useEffect(() => {
    const initial = setTimeout(fetchQueue, 0);
    const interval = setInterval(fetchQueue, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchQueue]);

  // Keeps the hook's own `items` in sync with the latest poll — a no-op
  // while isDragging (see the hook), so this can never fight the
  // optimistic order either.
  useEffect(() => {
    syncItems(upNext);
  }, [upNext, syncItems]);

  return (
    <section>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 sm:text-base">Очередь</p>

      {!loaded ? (
        <p className="mt-4 text-base text-white/50 sm:text-lg">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-base text-white/50 sm:text-lg">Очередь пуста</p>
      ) : (
        <DndContext {...dndContextProps}>
          <SortableContext items={items.map((song) => song.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 divide-y divide-white/10">
              {items.map((song) => (
                <SortableQueueRow key={song.id} song={song} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
