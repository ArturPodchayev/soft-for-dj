"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SongRequest } from "@/lib/songs";
import { formatRelativeTime } from "@/lib/time";
import StatusBadge from "./StatusBadge";
import DownloadStatusBadge from "./DownloadStatusBadge";
import SongDetailModal from "./SongDetailModal";

// Same cadence as PendingFeed/QueuePanel — this view has no Realtime
// subscription of its own (it needs pending/rejected rows too, which are
// excluded from the anon-key policy that Realtime rides on; see
// supabase/migrations/0001_init.sql), so it polls the authenticated route
// the same way those do.
const POLL_INTERVAL_MS = 3500;

// Russian plural forms for "заявка" — 1 заявка, 2-4 заявки, 0/5+/11-14 заявок.
function requestsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "заявку";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "заявки";
  return "заявок";
}

export default function AllRequestsSection() {
  const [songs, setSongs] = useState<SongRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongRequest | null>(null);
  const inFlight = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/songs/all", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSongs(data.songs);
      setError(null);
    } catch {
      setError("Не удалось обновить список — пробуем ещё раз…");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchAll, 0);
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchAll]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/songs/all", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      setConfirmOpen(false);
      setToast(`Удалено: ${data.deleted ?? 0} ${requestsWord(data.deleted ?? 0)}`);
      await fetchAll();
    } catch {
      setToast("Не удалось удалить — попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }

  const count = songs?.length ?? 0;

  return (
    <section className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-brand-fg">
          Все заявки{songs !== null && ` (${count})`}
        </h2>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={songs === null || count === 0}
          className="rounded-full bg-brand-accent px-5 py-2 text-xs font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Удалить всё
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-brand-fg/60">{error}</p>}

      <div className="overflow-x-auto rounded-2xl bg-brand-surface shadow-md">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-surface-fg/15 text-left text-xs uppercase tracking-wide text-brand-surface-fg/60">
              <th className="px-4 py-3 font-bold">Трек</th>
              <th className="px-4 py-3 font-bold">Заказчик</th>
              <th className="px-4 py-3 font-bold">Статус</th>
              <th className="px-4 py-3 font-bold">Скачивание</th>
              <th className="px-4 py-3 font-bold">Создана</th>
              <th className="px-4 py-3 font-bold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {songs === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-surface-fg/60">
                  Загрузка…
                </td>
              </tr>
            ) : songs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-surface-fg/60">
                  Заявок пока нет.
                </td>
              </tr>
            ) : (
              songs.map((song) => (
                <tr
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className="cursor-pointer border-b border-brand-surface-fg/5 text-brand-surface-fg transition-colors hover:bg-brand-surface-fg/5"
                >
                  <td className="max-w-[240px] px-4 py-2.5">
                    <p className="truncate font-medium">{song.song_title}</p>
                    <p className="truncate text-xs text-brand-surface-fg/60">{song.artist_name}</p>
                  </td>
                  <td className="max-w-[180px] px-4 py-2.5">
                    <p className="truncate">{song.requester_name}</p>
                    <p className="truncate text-xs text-brand-surface-fg/60">{song.phone}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={song.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {song.download_status === "not_started" ? (
                      <span className="text-brand-surface-fg/40">—</span>
                    ) : (
                      <DownloadStatusBadge status={song.download_status} reason={song.download_match_reason} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-brand-surface-fg/70">
                    {formatRelativeTime(song.submitted_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedSong(song)}
                      className="rounded-full bg-brand-surface-fg px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-surface transition-opacity hover:opacity-90"
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-brand-surface p-6 shadow-2xl">
            <p className="font-heading text-lg font-bold text-brand-surface-fg">Удалить ВСЕ заявки?</p>
            <p className="mt-2 text-sm text-brand-surface-fg/70">
              Будет удалено {count} {requestsWord(count)} — включая уже сыгранные и текущую очередь. Это
              необратимо.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-full border border-brand-surface-fg/20 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-brand-surface-fg transition-colors hover:bg-brand-surface-fg/5 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex-1 rounded-full bg-brand-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Удаляем…" : "Удалить всё"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-surface-fg px-5 py-3 text-sm font-medium text-brand-surface shadow-xl">
          {toast}
        </div>
      )}

      {selectedSong && (
        <SongDetailModal song={selectedSong} onClose={() => setSelectedSong(null)} onSaved={fetchAll} />
      )}
    </section>
  );
}
