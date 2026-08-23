"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SongRequest } from "@/lib/songs";
import PendingSongCard from "./PendingSongCard";

// True Supabase Realtime isn't available here: pending rows are deliberately
// excluded from the anon-key SELECT policy (see
// supabase/migrations/0001_init.sql) so a public visitor can't read other
// guests' names/phone numbers. Polling through the authenticated
// /api/admin/songs route keeps that boundary intact.
const POLL_INTERVAL_MS = 3500;

export default function PendingFeed() {
  const [songs, setSongs] = useState<SongRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const fetchPending = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/songs", { cache: "no-store" });
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
    const initial = setTimeout(fetchPending, 0);
    const interval = setInterval(fetchPending, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchPending]);

  async function handleApprove(
    id: string,
    input: { durationSeconds: number | null; youtubeUrl: string | null }
  ) {
    const res = await fetch(`/api/admin/songs/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Approve failed");
    setSongs((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/admin/songs/${id}/reject`, { method: "POST" });
    if (!res.ok) throw new Error("Reject failed");
    setSongs((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  }

  return (
    <section className="flex-1 px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-brand-fg">Заявки на модерации</h2>
        {error && <p className="text-sm text-brand-fg/60">{error}</p>}
      </div>

      {songs === null ? (
        <p className="text-brand-fg/60">Загрузка…</p>
      ) : songs.length === 0 ? (
        <p className="text-brand-fg/60">Нет заявок на модерации.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {songs.map((song) => (
            <PendingSongCard key={song.id} song={song} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}
    </section>
  );
}
