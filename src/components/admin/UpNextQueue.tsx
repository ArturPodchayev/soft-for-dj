"use client";

import { useEffect, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SongRequest } from "@/lib/songs";
import { useReorderableQueue } from "@/lib/useReorderableQueue";
import TrackQuickActions from "./TrackQuickActions";
import DownloadStatusBadge from "./DownloadStatusBadge";

// Three horizontal bars — a plain inline SVG rather than an icon package
// dependency for one glyph. Purely decorative (the grip button around it
// carries the aria-label), so aria-hidden.
function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
      <rect x="2" y="7.2" width="12" height="1.6" rx="0.8" />
      <rect x="2" y="11.4" width="12" height="1.6" rx="0.8" />
    </svg>
  );
}

function SortableSongItem({
  song,
  quickActionsVisible,
  onToggleExpanded,
}: {
  song: SongRequest;
  quickActionsVisible: boolean;
  onToggleExpanded: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`px-4 py-3 ${isDragging ? "relative z-10 bg-brand-surface shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* {...listeners}/{...attributes} live ONLY on this handle, not the
            <li> — so dragging can't hijack a tap on "⋯" a few pixels away. */}
        <button
          type="button"
          aria-label="Перетащить, чтобы изменить порядок"
          {...attributes}
          {...listeners}
          className="shrink-0 touch-none cursor-grab rounded-full p-1.5 text-brand-surface-fg/40 transition-colors hover:bg-brand-surface-fg/5 hover:text-brand-surface-fg/70 active:cursor-grabbing"
        >
          <GripIcon />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-brand-surface-fg">
            {song.song_title}
            <span className="font-normal text-brand-surface-fg/60"> — {song.artist_name}</span>
          </p>
          <p className="truncate text-xs text-brand-surface-fg/60">{song.requester_name}</p>
          <div className="mt-1.5">
            <DownloadStatusBadge status={song.download_status} reason={song.download_match_reason} />
          </div>
        </div>

        <button
          type="button"
          aria-label="Быстрые действия"
          onClick={onToggleExpanded}
          className="shrink-0 rounded-full border border-brand-surface-fg/20 px-2.5 py-1 text-brand-surface-fg transition-opacity hover:bg-brand-surface-fg/5"
        >
          ⋯
        </button>
      </div>

      {quickActionsVisible && (
        <div className="mt-3 border-t border-brand-surface-fg/10 pt-3">
          <TrackQuickActions artistName={song.artist_name} songTitle={song.song_title} />
        </div>
      )}
    </li>
  );
}

export default function UpNextQueue({
  upNext,
  onReorderSettled,
}: {
  upNext: SongRequest[];
  // Forwarded straight into useReorderableQueue — QueuePanel.tsx uses this
  // to force one extra poll after a successful reorder; this component
  // doesn't need to know why, it just passes it through.
  onReorderSettled?: (success: boolean) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  // All drag-and-drop mechanics (optimistic reorder, the POST, rollback on
  // failure, guarding a poll from clobbering an in-flight drag) live in
  // this one shared hook — see lib/useReorderableQueue.ts's docblock. This
  // component only adds its own error-toast text on failure and forwards
  // the outcome to whatever the caller passed in.
  const { items, syncItems, dndContextProps } = useReorderableQueue(upNext, {
    onReorderSettled: (success) => {
      if (!success) {
        setDragError("Не удалось сохранить порядок — попробуйте ещё раз.");
        window.setTimeout(() => setDragError(null), 3000);
      }
      onReorderSettled?.(success);
    },
  });

  // Keeps the hook's own `items` in sync with whatever QueuePanel's poll
  // last read — syncItems is a no-op while a drag/reorder is in flight (see
  // the hook), so this can never fight the optimistic order.
  useEffect(() => {
    syncItems(upNext);
  }, [upNext, syncItems]);

  return (
    <section className="px-6 pt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-fg/70">Следующие</p>
        {dragError && (
          <p className="text-xs font-semibold text-brand-accent" role="alert">
            {dragError}
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-brand-surface/95 p-2 shadow-md">
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-brand-surface-fg/60">Очередь пуста.</p>
        ) : (
          // No explicit `sensors` prop — dnd-kit's own default (pointer +
          // keyboard) already covers both mouse and touch, and this
          // moderator device may not even have a touchscreen (per the
          // brief); nothing here needs tuning against that default.
          <DndContext {...dndContextProps}>
            <SortableContext items={items.map((song) => song.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-brand-surface-fg/10">
                {items.map((song) => {
                  // Shown expanded by default (not behind "⋯") once the
                  // pipeline itself flags a row for review — this is exactly
                  // when the moderator needs the manual Hitmo/Sefon fallback
                  // links, not one click away from them.
                  const needsAttention = song.flagged_for_review;
                  const quickActionsVisible = expandedId === song.id || needsAttention;

                  return (
                    <SortableSongItem
                      key={song.id}
                      song={song}
                      quickActionsVisible={quickActionsVisible}
                      onToggleExpanded={() => setExpandedId((cur) => (cur === song.id ? null : song.id))}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
