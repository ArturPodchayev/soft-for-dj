"use client";

import { useState } from "react";
import { VENUE } from "@/config/venue";

export default function AdminHeader() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <header className="flex items-center justify-between border-b border-brand-fg/10 px-6 py-4">
      <h1 className="font-heading text-xl font-bold text-brand-fg">{VENUE.eventName} — Админка</h1>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-full border border-brand-fg/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-fg/80 transition-colors hover:border-brand-fg hover:text-brand-fg disabled:opacity-60"
      >
        {loggingOut ? "Выходим…" : "Выйти"}
      </button>
    </header>
  );
}
