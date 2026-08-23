"use client";

import Image from "next/image";
import { getSongThumbnailUrl } from "@/lib/albumArt";
import type { DisplaySong } from "@/lib/displayQueue";
import VinylDisc from "./VinylDisc";
import EqualizerBars from "./EqualizerBars";
import { useVerifiedThumbnailUrl } from "./useVerifiedThumbnail";

export default function DisplayCard({
  label,
  song,
  emptyText,
  variant,
  transitionVersion,
}: {
  label: string;
  song: DisplaySong | null;
  emptyText: string;
  variant: "primary" | "secondary";
  // Forwarded to EqualizerBars for its own brief burst accent on a track
  // change — unused for variant="secondary" (EqualizerBars is
  // primary-only) but harmless to pass through regardless.
  transitionVersion?: number;
}) {
  const isPrimary = variant === "primary";
  // No thumbnail -> VinylDisc just shows the bare grooved disc, and the
  // secondary card's box stays empty. Verified before rendering — see
  // useVerifiedThumbnailUrl's docblock: a YouTube-fallback URL here can
  // otherwise be a silently-broken maxresdefault guess.
  const thumbnailUrl = useVerifiedThumbnailUrl(getSongThumbnailUrl(song));

  return (
    // "Liquid glass" card: layered CSS only (no second WebGL context — the
    // ambient background already keeps one GPU-bound context running for
    // hours unattended). backdrop-blur-xl + backdrop-saturate boosts the
    // "glass" read over plain blur; the scrim/border/inner-glow divs below
    // each do one job — a thin flat scrim, a gradient edge-highlight ring,
    // and an inset top-edge glow.
    <div className="relative overflow-hidden rounded-[2rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.34),inset_0_3px_8px_-3px_rgba(255,255,255,0.2)] backdrop-blur-xl backdrop-saturate-[145%]">
      <div className={`pointer-events-none absolute inset-0 ${isPrimary ? "bg-black/6" : "bg-black/9"}`} />
      <div
        // The exclude composite operator is folded into the mask
        // shorthand's first layer (…content-box exclude) so the ring
        // actually punches its content-box hole, rather than filling the
        // whole card — Tailwind compiles classes in its own internal
        // property order, so a standalone mask-composite utility can lose
        // that race silently.
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-[1.5px] [background:linear-gradient(140deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.05)_60%)] [mask:linear-gradient(#fff_0_0)_content-box_exclude,linear-gradient(#fff_0_0)]"
      />
      <div
        className={`relative z-10 flex w-full items-center gap-[calc(1.5rem*var(--card-scale))] ${
          isPrimary
            ? "p-[calc(1.5rem*var(--card-scale))] sm:p-[calc(2.25rem*var(--card-scale))]"
            : // Secondary padding deliberately does NOT track --card-scale —
              // Now Playing's title alone routinely wraps to 2 lines under
              // line-clamp-2, and at the full scale factor Next Playing's
              // own padding eats enough of the vertical budget to clip
              // against the QR reserve below.
              "px-5 pt-5 pb-8 sm:px-6 sm:pt-6 sm:pb-9"
        }`}
      >
        <div className="min-w-0 flex-1 text-left">
          <p
            className={`flex items-center gap-[calc(0.5rem*var(--card-scale))] text-[length:calc(0.75rem*var(--card-scale))] font-bold uppercase tracking-widest [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] sm:text-[length:calc(0.875rem*var(--card-scale))] ${
              isPrimary ? "text-brand-accent-2" : "text-brand-accent-2/90"
            }`}
          >
            {label}
            {isPrimary && song && <EqualizerBars transitionVersion={transitionVersion} />}
          </p>

          {song ? (
            <>
              <p
                className={`truncate font-heading font-bold leading-tight tracking-[0.015em] text-brand-fg [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] ${
                  isPrimary
                    ? "mt-[calc(0.75rem*var(--card-scale))] text-[length:calc(3rem*var(--card-scale)*var(--card-text-scale))] sm:text-[length:calc(4.5rem*var(--card-scale)*var(--card-text-scale))]"
                    : "mt-2 text-[length:calc(1.5rem*var(--card-scale)*var(--card-text-scale))] text-brand-fg/80 sm:text-[length:calc(2.25rem*var(--card-scale)*var(--card-text-scale))]"
                }`}
              >
                {song.song_title}
              </p>
              <p
                className={`truncate [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] ${
                  isPrimary
                    ? "mt-[calc(0.5rem*var(--card-scale))] text-[length:calc(1.5rem*var(--card-scale)*var(--card-text-scale))] text-brand-fg/90 sm:text-[length:calc(1.875rem*var(--card-scale)*var(--card-text-scale))]"
                    : "mt-1 text-[length:calc(1rem*var(--card-scale)*var(--card-text-scale))] text-brand-fg/75 sm:text-[length:calc(1.125rem*var(--card-scale)*var(--card-text-scale))]"
                }`}
              >
                {song.artist_name}
              </p>
              <p
                className={`truncate [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] ${
                  isPrimary
                    ? "mt-[calc(0.25rem*var(--card-scale))] text-[length:calc(1rem*var(--card-scale)*var(--card-text-scale)*var(--requester-text-scale))] text-brand-fg/60 sm:text-[length:calc(1.125rem*var(--card-scale)*var(--card-text-scale)*var(--requester-text-scale))]"
                    : "mt-0.5 text-[length:calc(0.875rem*var(--card-scale)*var(--card-text-scale)*var(--requester-text-scale))] text-brand-fg/50 sm:text-[length:calc(1rem*var(--card-scale)*var(--card-text-scale)*var(--requester-text-scale))]"
                }`}
              >
                {song.requester_name}
              </p>
            </>
          ) : (
            <p
              className={`mt-[calc(0.5rem*var(--card-scale))] text-brand-fg/50 [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] ${
                isPrimary
                  ? "text-[length:calc(1.5rem*var(--card-scale)*var(--card-text-scale))]"
                  : "text-[length:calc(1.125rem*var(--card-scale)*var(--card-text-scale))]"
              }`}
            >
              {emptyText}
            </p>
          )}
        </div>

        {song &&
          (isPrimary ? (
            <VinylDisc thumbnailUrl={thumbnailUrl} spinning />
          ) : (
            <div className="relative h-[calc(6rem*var(--card-scale))] w-[calc(6rem*var(--card-scale))] shrink-0 overflow-hidden rounded-2xl bg-brand-accent/50 sm:h-[calc(7rem*var(--card-scale))] sm:w-[calc(7rem*var(--card-scale))]">
              {thumbnailUrl && (
                <Image src={thumbnailUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
