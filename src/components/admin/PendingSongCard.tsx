"use client";

import { useState } from "react";
import type { SongRequest } from "@/lib/songs";
import { formatRelativeTime } from "@/lib/time";
import StatusBadge from "./StatusBadge";
import TrackQuickActions from "./TrackQuickActions";

export default function PendingSongCard({
  song,
  onApprove,
  onReject,
}: {
  song: SongRequest;
  onApprove: (id: string, input: { durationSeconds: number | null; youtubeUrl: string | null }) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [durationSeconds, setDurationSeconds] = useState(
    song.duration_seconds != null ? String(song.duration_seconds) : ""
  );
  const [youtubeUrl, setYoutubeUrl] = useState(song.youtube_url ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);

  async function handleApprove() {
    setError(null);
    setBusy("approve");
    try {
      const parsedDuration = durationSeconds.trim() === "" ? null : Number(durationSeconds);
      await onApprove(song.id, {
        durationSeconds: Number.isFinite(parsedDuration) ? parsedDuration : null,
        youtubeUrl: youtubeUrl.trim() === "" ? null : youtubeUrl.trim(),
      });
    } catch {
      setError("Не удалось одобрить, попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setError(null);
    setBusy("reject");
    try {
      await onReject(song.id);
    } catch {
      setError("Не удалось отклонить, попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-3xl bg-brand-surface p-6 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-bold text-brand-surface-fg">{song.song_title}</p>
          <p className="text-sm text-brand-surface-fg/70">{song.artist_name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Быстрые действия"
            onClick={() => setQuickActionsExpanded((cur) => !cur)}
            className="rounded-full border border-brand-surface-fg/20 px-2.5 py-1 text-brand-surface-fg transition-opacity hover:bg-brand-surface-fg/5"
          >
            ⋯
          </button>
          <StatusBadge status={song.status} />
        </div>
      </div>

      {quickActionsExpanded && (
        <div className="mt-3 border-t border-brand-surface-fg/10 pt-3">
          <TrackQuickActions artistName={song.artist_name} songTitle={song.song_title} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-surface-fg/80">
        <span>Заказал: {song.requester_name}</span>
        <span>{song.phone}</span>
        <span>{formatRelativeTime(song.submitted_at)}</span>
      </div>

      <p className="mt-4 text-xs text-brand-surface-fg/50">
        Длительность и обложка подбираются автоматически (iTunes) при одобрении — поля ниже нужны, только
        если результат нужно поправить вручную.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`duration-${song.id}`} className="mb-1 block text-xs text-brand-surface-fg/60">
            Длительность, сек
          </label>
          <input
            id={`duration-${song.id}`}
            type="number"
            min={0}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            className="w-28 rounded-xl border border-brand-surface-fg/20 bg-white/60 px-3 py-2 text-sm text-brand-surface-fg outline-none focus:border-brand-accent"
          />
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor={`youtube-${song.id}`} className="mb-1 block text-xs text-brand-surface-fg/60">
            Ссылка YouTube (для DJ-вью)
          </label>
          <input
            id={`youtube-${song.id}`}
            type="url"
            placeholder="https://youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full rounded-xl border border-brand-surface-fg/20 bg-white/60 px-3 py-2 text-sm text-brand-surface-fg placeholder:text-brand-surface-fg/30 outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-brand-accent" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy !== null}
          className="flex-1 rounded-full bg-brand-accent-2 px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy === "approve" ? "Одобряем…" : "Одобрить"}
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={busy !== null}
          className="flex-1 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy === "reject" ? "Отклоняем…" : "Отклонить"}
        </button>
      </div>
    </div>
  );
}
