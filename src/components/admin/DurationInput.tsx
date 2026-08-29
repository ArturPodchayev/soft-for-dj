"use client";

import { useState } from "react";

// Drop-in replacement for a plain <input type="number"> bound to a
// total-seconds string — same value/onChange contract as everywhere else
// duration is edited (PendingSongCard, SongDetailModal): a string of total
// seconds, "" for unset. Splits into MM : SS purely for input convenience;
// both directions (split for display, minutes*60+seconds for commit) are
// plain integer math, so the round trip is always exact.
export default function DurationInput({
  idPrefix,
  label,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const totalSeconds = value.trim() === "" ? null : Number(value);
  const safeTotal =
    totalSeconds != null && Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : null;
  const minutes = safeTotal != null ? Math.floor(safeTotal / 60) : null;
  const seconds = safeTotal != null ? safeTotal % 60 : null;

  // Only affects the seconds field's display text (pad "5" -> "05" once
  // the moderator moves on) — the underlying value never needs padding, 5
  // and "05" both mean 5 seconds.
  const [secondsFocused, setSecondsFocused] = useState(false);

  function commit(nextMinutes: number | null, nextSeconds: number | null) {
    if (nextMinutes == null && nextSeconds == null) {
      onChange("");
      return;
    }
    onChange(String((nextMinutes ?? 0) * 60 + (nextSeconds ?? 0)));
  }

  // 0-59 for both fields — minutes doesn't need hour support here (a
  // request running past 59 minutes isn't a real case this form needs to
  // express), so clamping it the same way as seconds keeps both fields
  // consistent rather than one being open-ended.
  function clamp(raw: string): number {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(59, parsed));
  }

  function handleMinutesChange(raw: string) {
    if (raw.trim() === "") {
      commit(null, seconds);
      return;
    }
    commit(clamp(raw), seconds);
  }

  function handleSecondsChange(raw: string) {
    if (raw.trim() === "") {
      commit(minutes, null);
      return;
    }
    commit(minutes, clamp(raw));
  }

  const minutesDisplay = minutes != null ? String(minutes) : "";
  const secondsDisplay = seconds != null ? (secondsFocused ? String(seconds) : String(seconds).padStart(2, "0")) : "";

  return (
    <div>
      <label htmlFor={`${idPrefix}-minutes`} className="mb-1 block text-xs text-brand-surface-fg/60">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={`${idPrefix}-minutes`}
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          placeholder="0"
          value={minutesDisplay}
          onChange={(e) => handleMinutesChange(e.target.value)}
          aria-label="Минуты"
          className="w-14 rounded-xl border border-brand-surface-fg/20 bg-white/60 px-2 py-2 text-center text-sm text-brand-surface-fg outline-none focus:border-brand-accent"
        />
        <span className="text-sm font-bold text-brand-surface-fg/40">:</span>
        <input
          id={`${idPrefix}-seconds`}
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          placeholder="00"
          value={secondsDisplay}
          onChange={(e) => handleSecondsChange(e.target.value)}
          onFocus={() => setSecondsFocused(true)}
          onBlur={() => setSecondsFocused(false)}
          aria-label="Секунды"
          className="w-14 rounded-xl border border-brand-surface-fg/20 bg-white/60 px-2 py-2 text-center text-sm text-brand-surface-fg outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}
