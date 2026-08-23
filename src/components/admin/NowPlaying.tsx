"use client";

import { useEffect, useState } from "react";
import type { SongRequest } from "@/lib/songs";
import { formatDuration } from "@/lib/formatDuration";
import TrackQuickActions from "./TrackQuickActions";
import DownloadStatusBadge from "./DownloadStatusBadge";

export default function NowPlaying({
  playing,
  onAdvance,
}: {
  playing: SongRequest | null;
  onAdvance: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local clock, ticked once a second, just to re-render the countdown — the
  // real data still comes from polling; this only drives the ticking
  // display between polls.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  async function handleAdvance() {
    setError(null);
    setBusy(true);
    try {
      await onAdvance();
    } catch {
      setError("Не удалось обновить очередь, попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const elapsedSeconds =
    playing?.started_playing_at != null && now != null
      ? (now - new Date(playing.started_playing_at).getTime()) / 1000
      : null;

  return (
    <section className="px-6 pt-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-accent-2">Сейчас играет</p>

      <div className="rounded-3xl bg-brand-surface p-8 shadow-xl">
        {playing ? (
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="font-heading text-3xl font-bold text-brand-surface-fg sm:text-4xl">
                {playing.song_title}
              </p>
              <p className="mt-1 text-lg text-brand-surface-fg/70">{playing.artist_name}</p>
              <p className="mt-2 text-sm text-brand-surface-fg/60">Заказал: {playing.requester_name}</p>
              <div className="mt-2">
                <DownloadStatusBadge status={playing.download_status} reason={playing.download_match_reason} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
              {playing.duration_seconds != null && elapsedSeconds != null ? (
                <div className="text-right">
                  <p className="font-heading text-2xl font-bold text-brand-accent-2">
                    {formatDuration(playing.duration_seconds - elapsedSeconds)}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-brand-surface-fg/50">осталось</p>
                </div>
              ) : elapsedSeconds != null ? (
                <div className="text-right">
                  <p className="font-heading text-2xl font-bold text-brand-surface-fg/60">
                    {formatDuration(elapsedSeconds)}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-brand-surface-fg/50">
                    прошло — длительность не указана
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleAdvance}
                disabled={busy}
                className="rounded-full bg-brand-accent-2 px-8 py-4 text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Выполняем…" : "Далее ▶"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <p className="text-lg text-brand-surface-fg/60">Ничего не играет</p>
            <button
              type="button"
              onClick={handleAdvance}
              disabled={busy}
              className="rounded-full bg-brand-accent-2 px-8 py-4 text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Выполняем…" : "Старт"}
            </button>
          </div>
        )}

        {playing && (
          <div className="mt-6 border-t border-brand-surface-fg/10 pt-4">
            <TrackQuickActions artistName={playing.artist_name} songTitle={playing.song_title} />
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-brand-accent" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
