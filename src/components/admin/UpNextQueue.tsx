"use client";

import { useState } from "react";
import type { SongRequest } from "@/lib/songs";
import TrackQuickActions from "./TrackQuickActions";
import DownloadStatusBadge from "./DownloadStatusBadge";

export default function UpNextQueue({ upNext }: { upNext: SongRequest[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="px-6 pt-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-fg/70">Следующие</p>

      <div className="rounded-3xl bg-brand-surface/95 p-2 shadow-md">
        {upNext.length === 0 ? (
          <p className="px-4 py-4 text-sm text-brand-surface-fg/60">Очередь пуста.</p>
        ) : (
          <ul className="divide-y divide-brand-surface-fg/10">
            {upNext.map((song) => {
              // Shown expanded by default (not behind "⋯") once the
              // pipeline itself flags a row for review — this is exactly
              // when the moderator needs the manual Hitmo/Sefon fallback
              // links, not one click away from them.
              const needsAttention = song.flagged_for_review;
              const quickActionsVisible = expandedId === song.id || needsAttention;

              return (
                <li key={song.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
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
                      onClick={() => setExpandedId((cur) => (cur === song.id ? null : song.id))}
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
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
