"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { DisplayQueue, DisplaySong } from "@/lib/displayQueue";
import { useRealtimeDisplayQueue } from "@/lib/useRealtimeDisplayQueue";
import { getSongThumbnailUrl } from "@/lib/albumArt";
import { VENUE } from "@/config/venue";
import DisplayCard from "./DisplayCard";
import AmbientBackgroundGL from "./AmbientBackgroundGL";
import { useAlbumPalette } from "./useAlbumPalette";
import { useVerifiedThumbnailUrl } from "@/lib/useVerifiedThumbnail";

// Now Playing's exit animation duration (see card-burst-exit in
// globals.css) — kept as one constant here so the snapshot-cleanup timeout
// below can't silently drift from the CSS value it has to outlive.
const EXIT_ANIMATION_MS = 300;
const EXIT_CLEANUP_MS = EXIT_ANIMATION_MS + 50;

// The whole card/header/QR layout below is authored against this exact
// canvas — every dimension inside it is px/rem/calc(...*var(--card-scale)),
// never vh/vw/%-of-viewport. That distinction matters for kiosk deployment:
// the real viewport height genuinely differs between a maximized window and
// true F11 fullscreen at the same browser zoom. Rendering against a fixed
// 1920x1080 design canvas and scaling that whole canvas as one rigid unit
// (below) removes the viewport as an input to the layout entirely.
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export default function DisplayScreen({
  submitUrl,
  initialData,
}: {
  submitUrl: string;
  initialData: DisplayQueue;
}) {
  // Realtime subscription + anti-flicker — shared with /dj-view (see
  // lib/useRealtimeDisplayQueue.ts) so the two screens can never disagree
  // on how "what's playing/next" is fetched or debounced.
  const data = useRealtimeDisplayQueue(initialData);

  // Uniform fit-to-viewport factor for the fixed DESIGN_WIDTH x
  // DESIGN_HEIGHT stage below. Math.min (not separate x/y factors) keeps
  // the design's proportions rigid: whichever axis is tighter sets the
  // scale for BOTH axes, so the stage shrinks/grows as one unit and
  // letterboxes on the other axis rather than stretching.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const playingKey = data.playing ? `${data.playing.song_title}::${data.playing.artist_name}` : "playing-empty";
  const nextKey = data.next ? `${data.next.song_title}::${data.next.artist_name}` : "next-empty";

  // transitionVersion is the single source of truth for "Now Playing just
  // changed track" — bumped exactly once per genuine change, and read by
  // three independent consumers that must never fire out of sync:
  // AmbientBackgroundGL's shader burst uniform, EqualizerBars' burst state
  // (via DisplayCard), and the enter/exit card animation below.
  const transitionVersionRef = useRef(0);
  const [transitionVersion, setTransitionVersion] = useState(0);
  const prevPlayingKeyRef = useRef(playingKey);
  const prevPlayingSongRef = useRef(data.playing);
  const [exitingSnapshot, setExitingSnapshot] = useState<{ version: number; song: DisplaySong | null } | null>(
    null
  );

  useEffect(() => {
    if (playingKey === prevPlayingKeyRef.current) {
      prevPlayingSongRef.current = data.playing;
      return;
    }
    const outgoingSong = prevPlayingSongRef.current;
    prevPlayingKeyRef.current = playingKey;
    prevPlayingSongRef.current = data.playing;

    transitionVersionRef.current += 1;
    const version = transitionVersionRef.current;
    setTransitionVersion(version);
    setExitingSnapshot({ version, song: outgoingSong });

    const timeout = setTimeout(() => {
      setExitingSnapshot((current) => (current?.version === version ? null : current));
    }, EXIT_CLEANUP_MS);
    return () => clearTimeout(timeout);
  }, [playingKey, data.playing]);

  // Ambient background is tinted from whatever's actually on screen in the
  // Now Playing card, not the Next Playing one.
  const palette = useAlbumPalette(useVerifiedThumbnailUrl(getSongThumbnailUrl(data.playing)));

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: VENUE.colors.background }}>
      <AmbientBackgroundGL palette={palette} transitionVersion={transitionVersion} />

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="relative z-10 flex h-full flex-col px-8 py-8 text-center sm:px-16 sm:py-10">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold tracking-[0.015em] text-brand-fg sm:text-4xl">
              {VENUE.copy.displayHeading}
            </h1>
            <p className="font-heading text-lg font-bold text-brand-fg/70">{VENUE.djName}</p>
          </div>

          <div className="min-h-0 flex-1">
            <div className="flex h-[calc(100%-15.5rem)] flex-col items-center justify-start gap-[calc(1rem*var(--card-scale))] overflow-hidden pt-2 sm:h-[calc(100%-16rem)] sm:pt-3">
              <div className="grid w-full max-w-[calc(80rem*var(--card-scale))]">
                {exitingSnapshot && (
                  <div
                    key={`exit-${exitingSnapshot.version}`}
                    className="col-start-1 row-start-1 animate-[card-burst-exit_300ms_ease-in_both]"
                  >
                    <DisplayCard
                      label="Сейчас играет:"
                      song={exitingSnapshot.song}
                      emptyText="Ждём заявки…"
                      variant="primary"
                    />
                  </div>
                )}
                <div
                  key={`enter-${transitionVersion}`}
                  className="col-start-1 row-start-1 animate-[card-burst-enter_750ms_cubic-bezier(0.22,0,0,1)_60ms_both]"
                >
                  <DisplayCard
                    label="Сейчас играет:"
                    song={data.playing}
                    emptyText="Ждём заявки…"
                    variant="primary"
                    transitionVersion={transitionVersion}
                  />
                </div>
              </div>

              <div
                key={nextKey}
                className="w-full max-w-[calc(80rem*var(--card-scale))] animate-[fade-in_500ms_ease-out]"
              >
                <DisplayCard label="Следующий:" song={data.next} emptyText="Заявок пока нет" variant="secondary" />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-8 bottom-8 flex justify-center sm:inset-x-16 sm:bottom-10">
            <div className="w-full max-w-3xl">
              <QrCard submitUrl={submitUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QrCard({ submitUrl }: { submitUrl: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-[2rem] bg-brand-surface p-6 shadow-2xl sm:p-8">
      <QRCodeSVG value={submitUrl} size={150} bgColor={VENUE.colors.surface} fgColor={VENUE.colors.surfaceForeground} />
      <p className="text-base font-bold uppercase tracking-wide text-brand-surface-fg sm:text-lg">
        {VENUE.copy.qrCaption}
      </p>
    </div>
  );
}
