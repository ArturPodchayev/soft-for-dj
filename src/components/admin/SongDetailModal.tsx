"use client";

import { useState } from "react";
import Image from "next/image";
import type { SongRequest } from "@/lib/songs";
import StatusBadge from "./StatusBadge";
import DownloadStatusBadge from "./DownloadStatusBadge";
import DurationInput from "./DurationInput";

type GeniusCandidate = {
  id: number;
  title: string;
  artistName: string;
  imageUrl: string;
  thumbnailUrl: string;
  geniusUrl: string;
};

export default function SongDetailModal({
  song,
  onClose,
  onSaved,
}: {
  song: SongRequest;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [songTitle, setSongTitle] = useState(song.song_title);
  const [artistName, setArtistName] = useState(song.artist_name);
  const [requesterName, setRequesterName] = useState(song.requester_name);
  const [durationSeconds, setDurationSeconds] = useState(
    song.duration_seconds != null ? String(song.duration_seconds) : ""
  );
  const [youtubeUrl, setYoutubeUrl] = useState(song.youtube_url ?? "");
  const [albumArtUrl, setAlbumArtUrl] = useState(song.album_art_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [geniusSearching, setGeniusSearching] = useState(false);
  const [geniusMessage, setGeniusMessage] = useState<string | null>(null);
  const [geniusCandidates, setGeniusCandidates] = useState<GeniusCandidate[]>([]);

  async function handleGeniusSearch() {
    setGeniusMessage(null);
    setGeniusCandidates([]);
    setGeniusSearching(true);
    try {
      const res = await fetch("/api/admin/genius-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${artistName} ${songTitle}` }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.status !== "ok") {
        setGeniusMessage(data?.message ?? "Поиск через Genius не удался, попробуйте ещё раз.");
        return;
      }

      setGeniusCandidates(data.candidates);
      setGeniusMessage(`Найдено вариантов: ${data.candidates.length} — выберите подходящий ниже.`);
    } catch {
      setGeniusMessage("Поиск через Genius не удался, попробуйте ещё раз.");
    } finally {
      setGeniusSearching(false);
    }
  }

  async function handleRelookup() {
    setLookupMessage(null);
    setLooking(true);
    try {
      const res = await fetch("/api/admin/songs/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songTitle, artistName }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.status !== "ok") {
        setLookupMessage(data?.message ?? "Поиск не удался, найдите вручную.");
        return;
      }

      if (data.durationSeconds != null) setDurationSeconds(String(data.durationSeconds));
      if (data.albumArtUrl != null) setAlbumArtUrl(data.albumArtUrl);

      setLookupMessage(
        data.durationSeconds == null && data.albumArtUrl == null
          ? "Ничего не найдено, найдите вручную."
          : "Обновлено из iTunes."
      );
    } catch {
      setLookupMessage("Поиск не удался, найдите вручную.");
    } finally {
      setLooking(false);
    }
  }

  async function handleSave() {
    setError(null);

    const trimmedDuration = durationSeconds.trim();
    let parsedDuration: number | null = null;
    if (trimmedDuration !== "") {
      const n = Number(trimmedDuration);
      if (!Number.isFinite(n) || n < 0) {
        setError("Некорректная длительность");
        return;
      }
      parsedDuration = Math.round(n);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/songs/${song.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_title: songTitle,
          artist_name: artistName,
          requester_name: requesterName,
          duration_seconds: parsedDuration,
          youtube_url: youtubeUrl.trim() === "" ? null : youtubeUrl.trim(),
          album_art_url: albumArtUrl.trim() === "" ? null : albumArtUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const firstError = data?.errors ? (Object.values(data.errors)[0] as string) : null;
        setError(firstError ?? data?.message ?? "Не удалось сохранить, попробуйте ещё раз.");
        return;
      }

      await onSaved();
      onClose();
    } catch {
      setError("Не удалось сохранить, попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-brand-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-heading text-lg font-bold text-brand-surface-fg">Детали заявки</p>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={song.status} />
            <DownloadStatusBadge status={song.download_status} reason={song.download_match_reason} />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Название песни" value={songTitle} onChange={setSongTitle} />
          <Field label="Исполнитель" value={artistName} onChange={setArtistName} />
          <Field label="Имя заказчика" value={requesterName} onChange={setRequesterName} />

          <div>
            <label className="mb-1 block text-xs text-brand-surface-fg/60">Телефон</label>
            <p className="rounded-xl border border-brand-surface-fg/10 bg-white/40 px-3 py-2 text-sm text-brand-surface-fg/70">
              {song.phone}
            </p>
          </div>

          <DurationInput
            idPrefix={`song-${song.id}-duration`}
            label="Длительность"
            value={durationSeconds}
            onChange={setDurationSeconds}
          />
          <Field
            label="Ссылка YouTube"
            value={youtubeUrl}
            onChange={setYoutubeUrl}
            placeholder="https://youtube.com/watch?v=…"
          />

          <div>
            <label className="mb-1 block text-xs text-brand-surface-fg/60">Обложка</label>
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-surface-fg/10">
                {albumArtUrl && (
                  // Admin-pasted URLs can be from any host — unoptimized
                  // skips next/image's remote-domain allowlist requirement,
                  // same approach used for track thumbnails elsewhere
                  // (DisplayCard.tsx, VinylDisc.tsx).
                  <Image src={albumArtUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                )}
              </div>
              <input
                type="url"
                value={albumArtUrl}
                onChange={(e) => setAlbumArtUrl(e.target.value)}
                placeholder="https://…"
                className="w-full min-w-0 flex-1 rounded-xl border border-brand-surface-fg/20 bg-white/60 px-3 py-2 text-sm text-brand-surface-fg placeholder:text-brand-surface-fg/30 outline-none focus:border-brand-accent"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {albumArtUrl && (
                <button
                  type="button"
                  onClick={() => setAlbumArtUrl("")}
                  className="text-xs font-bold uppercase tracking-wide text-brand-accent hover:opacity-80"
                >
                  Убрать картинку
                </button>
              )}
              <button
                type="button"
                onClick={handleGeniusSearch}
                disabled={geniusSearching}
                title="Ищет обложку на Genius по названию и исполнителю"
                className="rounded-full border border-brand-surface-fg/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-surface-fg transition-colors hover:bg-brand-surface-fg/5 disabled:opacity-60"
              >
                {geniusSearching ? "Ищем в Genius…" : "Genius"}
              </button>
            </div>

            {geniusMessage && <p className="mt-2 text-sm text-brand-surface-fg/70">{geniusMessage}</p>}

            {geniusCandidates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {geniusCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setAlbumArtUrl(candidate.imageUrl);
                      setGeniusCandidates([]);
                      setGeniusMessage(`Применено: ${candidate.artistName} — ${candidate.title}`);
                    }}
                    title={`${candidate.artistName} — ${candidate.title}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-transparent transition-shadow hover:ring-brand-accent"
                  >
                    <Image src={candidate.thumbnailUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={handleRelookup}
              disabled={looking}
              title="Длительность и обложка — из iTunes, тот же источник, что и при одобрении"
              className="rounded-full border border-brand-surface-fg/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-surface-fg transition-colors hover:bg-brand-surface-fg/5 disabled:opacity-60"
            >
              {looking ? "Ищем…" : "Найти заново"}
            </button>
            {lookupMessage && <p className="mt-2 text-sm text-brand-surface-fg/70">{lookupMessage}</p>}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-brand-accent" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full bg-brand-accent-2 px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border border-brand-surface-fg/20 px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-surface-fg/70 transition-colors hover:bg-brand-surface-fg/5"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-brand-surface-fg/60">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-brand-surface-fg/20 bg-white/60 px-3 py-2 text-sm text-brand-surface-fg placeholder:text-brand-surface-fg/30 outline-none focus:border-brand-accent"
      />
    </div>
  );
}
