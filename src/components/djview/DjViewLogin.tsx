"use client";

import { useState, type FormEvent } from "react";

// /dj-view has no separate login route (unlike /admin/login) — it's meant
// to stay a single URL the DJ opens once, per the TZ's "no device-selection
// screen" brief. Shown in place of DjView itself whenever the page's own
// server component (page.tsx) finds no valid admin session cookie; posts to
// the same /api/admin/login endpoint /admin/login uses (same
// ADMIN_PASSWORD, same session cookie) since the "Переключить" button below
// needs that session to call the already-existing, already-protected
// POST /api/admin/queue/next. A full reload (not router.refresh()) after
// success so the server component re-reads the now-set cookie from scratch.
export default function DjViewLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Не удалось войти");
        setSubmitting(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/5 p-8">
        <p className="text-lg font-bold text-white">DJ-вью</p>
        <p className="mt-1 text-sm text-white/50">Нужен пароль администратора — «Переключить» дёргает ту же очередь.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-2xl border border-white/15 bg-black px-5 py-4 text-white outline-none focus:border-white/40"
          />

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-white px-6 py-4 text-sm font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
