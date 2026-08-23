"use client";

import { useState } from "react";

// Manual-download helper for Stage 1, while Module 4 (autosearch +
// autodownload — see for-claude/TZ_DJ_Party_2.0.pdf) isn't built yet: opens
// the same two primary/first-fallback sources the TZ names (Hitmo, Sefon)
// pre-filled with the track's artist/title, and a one-click share of both
// links to the DJ over Telegram. Nothing here downloads or transfers audio.
function hitmoUrl(artistName: string, songTitle: string): string {
  return `https://eu.hitmoz.com/search?q=${encodeURIComponent(`${artistName} ${songTitle}`)}`;
}

function sefonUrl(artistName: string, songTitle: string): string {
  return `https://sefon.pro/search/${encodeURIComponent(`${artistName} ${songTitle}`)}/`;
}

// Telegram's share dialog has no way to target a specific recipient by
// link — text= only works through this share flow, so the moderator still
// picks the DJ's chat themselves, in one click, from Telegram's own
// share-target list. url= is required (Telegram redirects to telegram.org
// otherwise); its value isn't meaningful to the DJ, so any valid https link
// works.
function telegramShareUrl(artistName: string, songTitle: string, shareUrl: string): string {
  const text = `${artistName} - ${songTitle}\n\nHitmo: ${hitmoUrl(artistName, songTitle)}\nSefon: ${sefonUrl(artistName, songTitle)}`;
  return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
}

const linkButtonClass =
  "rounded-full border border-brand-surface-fg/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-surface-fg transition-colors hover:bg-brand-surface-fg/5";

export default function TrackQuickActions({ artistName, songTitle }: { artistName: string; songTitle: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${artistName} - ${songTitle}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable — button just won't confirm.
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/admin" : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={hitmoUrl(artistName, songTitle)} target="_blank" rel="noopener noreferrer" className={linkButtonClass}>
        Hitmo
      </a>
      <a href={sefonUrl(artistName, songTitle)} target="_blank" rel="noopener noreferrer" className={linkButtonClass}>
        Sefon
      </a>
      <a
        href={telegramShareUrl(artistName, songTitle, shareUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-brand-accent-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-bg transition-opacity hover:opacity-90"
      >
        Отправить DJ
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full bg-brand-surface-fg/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-surface-fg/70 transition-colors hover:bg-brand-surface-fg/20"
      >
        {copied ? "Скопировано ✓" : "Скопировать текст"}
      </button>
    </div>
  );
}
