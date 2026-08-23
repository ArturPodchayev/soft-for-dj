"use client";

import { useEffect, useRef, useState } from "react";

const BARS_CONFIG = [
  { color: "bg-brand-accent-2", height: "h-3" },
  { color: "bg-brand-fg", height: "h-4" },
  { color: "bg-brand-accent-2", height: "h-2.5" },
  { color: "bg-brand-fg", height: "h-3.5" },
];

const MIN_SCALE = 0.08;
const MAX_SCALE = 1.5;
const MIN_INTERVAL_MS = 80;
const MAX_INTERVAL_MS = 220;
const MIN_TRANSITION_MS = 60;
const MAX_TRANSITION_MS = 200;
// Caps how far one random target can move from the current value — without
// this, a bar can land at 0.08 then 1.5 back-to-back, which reads as
// teleporting rather than as a lively, unpredictable meter.
const MAX_JUMP = 0.9;

// Track-change accent: briefly amplifies the same random-chaos loop below
// rather than switching modes, so it reads as "the meter got excited," not
// a visibly different animation kicking in. isBurstingRef (not React state)
// because the per-bar tick loop below is a mount-only effect (empty deps —
// it must NOT restart on every burst, that would reset each bar's in-flight
// transition) whose closures need to read the CURRENT burst status on every
// tick without the effect itself re-running.
const BURST_DURATION_MS = 200;
const BURST_SCALE_MULTIPLIER = 1.35;
const BURST_INTERVAL_DIVISOR = 2.2;

// Real VU-meter bars snap up fast and settle back down slower — applied per
// random transition below based on whether it's rising or falling.
const ATTACK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const RELEASE_EASING = "cubic-bezier(0.55, 0, 0.85, 0.35)";

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function nextScale(current: number, isBursting: boolean) {
  const ceiling = isBursting ? MAX_SCALE * BURST_SCALE_MULTIPLIER : MAX_SCALE;
  const target = randomBetween(MIN_SCALE, ceiling);
  const delta = target - current;
  return Math.abs(delta) <= MAX_JUMP ? target : current + Math.sign(delta) * MAX_JUMP;
}

type BarState = { scale: number; transitionMs: number; easing: string };

// Small pulsing equalizer next to "Now playing:" — shown only while a track
// is actually playing. Each of the 4 bars runs its own independent
// randomized setTimeout loop (never synced to the others), so the set reads
// as chaotic/alive instead of 4 bars visibly repeating the same pattern.
export default function EqualizerBars({ transitionVersion }: { transitionVersion?: number }) {
  const [bars, setBars] = useState<BarState[]>(() =>
    BARS_CONFIG.map(() => ({ scale: 0.5, transitionMs: 200, easing: ATTACK_EASING }))
  );
  const isBurstingRef = useRef(false);
  const hasMountedBurstRef = useRef(false);

  useEffect(() => {
    if (transitionVersion === undefined) return;
    if (!hasMountedBurstRef.current) {
      hasMountedBurstRef.current = true;
      return;
    }
    isBurstingRef.current = true;
    const timeout = setTimeout(() => {
      isBurstingRef.current = false;
    }, BURST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [transitionVersion]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    BARS_CONFIG.forEach((_, index) => {
      const scheduleNext = () => {
        const interval =
          randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS) / (isBurstingRef.current ? BURST_INTERVAL_DIVISOR : 1);
        timeouts[index] = setTimeout(tick, interval);
      };
      const tick = () => {
        setBars((prev) => {
          const current = prev[index].scale;
          const target = nextScale(current, isBurstingRef.current);
          const next = [...prev];
          next[index] = {
            scale: target,
            transitionMs: Math.round(randomBetween(MIN_TRANSITION_MS, MAX_TRANSITION_MS)),
            easing: target >= current ? ATTACK_EASING : RELEASE_EASING,
          };
          return next;
        });
        scheduleNext();
      };
      scheduleNext();
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <span aria-hidden className="inline-flex h-4 items-end gap-[3px] align-middle">
      {BARS_CONFIG.map((bar, i) => (
        <span
          key={i}
          className={`w-[3px] origin-bottom rounded-full ${bar.color} ${bar.height}`}
          style={{
            transform: `scaleY(${bars[i].scale})`,
            transition: `transform ${bars[i].transitionMs}ms ${bars[i].easing}`,
          }}
        />
      ))}
    </span>
  );
}
