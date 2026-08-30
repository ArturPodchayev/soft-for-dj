"use client";

import Image from "next/image";
import type { DisplayQueue } from "@/lib/displayQueue";
import { useRealtimeDisplayQueue } from "@/lib/useRealtimeDisplayQueue";
import { useVerifiedThumbnailUrl } from "@/lib/useVerifiedThumbnail";
import { getSongThumbnailUrl } from "@/lib/albumArt";

// The DJ's working screen (TZ Module 5) — sits next to Serato on the same
// laptop, either a narrow window or full-screen on a phone/tablet propped
// beside the controller. Deliberately NOT built like /display
// (DisplayScreen.tsx): no WebGL background, no vinyl spin, no venue
// branding, no fixed 1920x1080 design canvas — this is a glanceable status
// panel a DJ reads peripherally while hands stay on the controller, not a
// projector showpiece. Plain flex stacking + Tailwind breakpoints is
// enough to read equally well in a half-laptop-screen window and a
// full-screen phone in portrait or landscape, which a fixed design canvas
// (scaled as one rigid unit) is specifically the wrong tool for here.
//
// Realtime + anti-flicker come from the same shared hook /display uses
// (lib/useRealtimeDisplayQueue.ts) — one source of truth for "what's
// playing/next," not a second implementation that could drift from it.
export default function DjView({ initialData }: { initialData: DisplayQueue }) {
  const data = useRealtimeDisplayQueue(initialData);
  const thumbnailUrl = useVerifiedThumbnailUrl(getSongThumbnailUrl(data.playing));

  // Deliberately just a boolean, per the brief — the DJ needs "can I cue
  // this up" at a glance, not download_status's full state machine
  // (searching/downloading/needs_review/failed all read the same here:
  // not ready yet). flagged_for_review, error reasons, etc. are an
  // admin/moderator concern (see DownloadStatusBadge), not this screen's.
  const nextReady = data.next?.download_status === "ready";

  return (
    <div className="flex min-h-screen flex-col justify-center gap-8 bg-black px-5 py-10 text-white sm:gap-12 sm:px-12">
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 sm:text-base">Сейчас играет</p>

        {data.playing ? (
          <div className="mt-4 flex items-center gap-5 sm:mt-6 sm:gap-8">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 sm:h-32 sm:w-32">
              {thumbnailUrl && (
                <Image src={thumbnailUrl} alt="" fill sizes="128px" className="object-cover" unoptimized />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-3xl font-bold leading-tight sm:text-6xl">{data.playing.song_title}</p>
              <p className="mt-1 truncate text-xl text-white/70 sm:mt-2 sm:text-3xl">{data.playing.artist_name}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-2xl text-white/50 sm:mt-6 sm:text-4xl">Ничего не играет</p>
        )}
      </section>

      <div className="h-px w-full bg-white/10" />

      <section>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 sm:text-base">Далее</p>

          {data.next && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide sm:px-4 sm:py-2 sm:text-sm ${
                nextReady ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${nextReady ? "bg-emerald-400" : "bg-red-400"}`} />
              {nextReady ? "Готов" : "Не готов"}
            </span>
          )}
        </div>

        {data.next ? (
          <div className="mt-4 sm:mt-6">
            <p className="truncate text-2xl font-bold leading-tight sm:text-5xl">{data.next.song_title}</p>
            <p className="mt-1 truncate text-lg text-white/70 sm:mt-2 sm:text-2xl">{data.next.artist_name}</p>
          </div>
        ) : (
          <p className="mt-4 text-xl text-white/50 sm:mt-6 sm:text-3xl">Очередь пуста</p>
        )}
      </section>
    </div>
  );
}
