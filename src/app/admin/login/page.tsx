"use client";

import { useState, type FormEvent } from "react";
import { VENUE } from "@/config/venue";

export default function AdminLoginPage() {
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

      window.location.href = "/admin";
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm rounded-3xl bg-brand-surface p-8 shadow-xl">
        <h1 className="font-heading text-2xl font-bold text-brand-surface-fg">{VENUE.eventName} — Админка</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-brand-surface-fg/70">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-brand-surface-fg/20 bg-white/60 px-5 py-4 text-brand-surface-fg outline-none focus:border-brand-accent"
            />
          </div>

          {error && (
            <p className="text-sm text-brand-accent" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-accent px-6 py-4 font-sans text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
