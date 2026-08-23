"use client";

import { useState, type FormEvent } from "react";
import { VENUE } from "@/config/venue";

type FieldErrors = Record<string, string>;

const PHONE_COUNTRY_CODE = "+998";

function formatPhoneDigits(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter(Boolean)
    .join(" ");
}

export default function SubmitSongForm() {
  const [requesterName, setRequesterName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // "rejected" happens when the phone number trips the fake-number
  // heuristic server-side — same terminal, no-retry screen shape as
  // "success", just without implying the request will actually be played.
  // Deliberately never distinguished from a real submission failure in a
  // way that would hint the phone number was the issue.
  const [outcome, setOutcome] = useState<"success" | "rejected" | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    // Client-side check is UX-only — the real validation happens
    // server-side in /api/requests. Deliberately does NOT duplicate the
    // fake-number heuristic here: that check must only ever happen
    // server-side and lead to the silent, terminal "rejected" outcome, not
    // a fixable inline error the requester could tweak-and-resubmit past.
    const nextErrors: FieldErrors = {};
    if (requesterName.trim().length < 2) nextErrors.requesterName = "Введите имя";
    if (songTitle.trim().length < 1) nextErrors.songTitle = "Введите название трека";
    if (artistName.trim().length < 1) nextErrors.artistName = "Введите имя исполнителя";
    if (!/^\d{9}$/.test(phoneDigits)) {
      nextErrors.phone = "Введите 9-значный номер телефона";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const phone = `${PHONE_COUNTRY_CODE}${phoneDigits}`;

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterName, songTitle, artistName, phone }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.errors) {
          setErrors(data.errors);
        } else {
          setSubmitError(data?.message ?? "Что-то пошло не так, попробуйте ещё раз.");
        }
        setSubmitting(false);
        return;
      }

      setOutcome(data?.rejected ? "rejected" : "success");
      setSubmitting(false);
    } catch {
      setSubmitError("Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.");
      setSubmitting(false);
    }
  }

  if (outcome === "success") {
    return (
      <div className="rounded-3xl border border-brand-fg/15 bg-brand-surface/10 px-6 py-12 text-center">
        <p className="font-heading text-2xl font-bold text-brand-accent">{VENUE.copy.submitSuccessTitle}</p>
        <p className="mx-auto mt-3 max-w-sm text-brand-fg/80">{VENUE.copy.submitSuccessBody}</p>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="rounded-3xl border border-brand-fg/15 bg-brand-surface/10 px-6 py-12 text-center">
        <p className="font-heading text-2xl font-bold text-brand-fg">{VENUE.copy.submitRejectedTitle}</p>
        <p className="mx-auto mt-3 max-w-sm text-brand-fg/80">{VENUE.copy.submitRejectedBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field
        label="Ваше имя"
        name="requesterName"
        value={requesterName}
        onChange={setRequesterName}
        error={errors.requesterName}
        autoComplete="name"
      />
      <Field
        label="Название трека"
        name="songTitle"
        value={songTitle}
        onChange={setSongTitle}
        error={errors.songTitle}
      />
      <Field
        label="Исполнитель"
        name="artistName"
        value={artistName}
        onChange={setArtistName}
        error={errors.artistName}
      />

      <div>
        <label htmlFor="phone" className="mb-2 block text-sm text-brand-fg/70">
          Ваш телефон
        </label>
        <div
          className={`flex items-center overflow-hidden rounded-2xl border bg-brand-surface/90 focus-within:border-brand-accent ${
            errors.phone ? "border-brand-accent" : "border-brand-fg/20"
          }`}
        >
          {/* Fixed country code — plain text, not part of the input, so it
              can't be edited or deleted. */}
          <span className="select-none border-r border-brand-surface-fg/20 py-4 pl-5 pr-3 font-medium text-brand-surface-fg/70">
            {PHONE_COUNTRY_CODE}
          </span>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={formatPhoneDigits(phoneDigits)}
            onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="w-full min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-brand-surface-fg placeholder:text-brand-surface-fg/30 outline-none"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
        </div>
        {errors.phone && (
          <p id="phone-error" className="mt-2 text-sm font-semibold text-brand-accent">
            {errors.phone}
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-sm font-semibold text-brand-accent" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-brand-accent px-6 py-4 font-sans text-sm font-bold uppercase tracking-widest text-brand-bg transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Отправляем…" : "Заказать трек"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm text-brand-fg/70">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border bg-brand-surface/90 px-5 py-4 text-brand-surface-fg placeholder:text-brand-surface-fg/30 outline-none focus:border-brand-accent ${
          error ? "border-brand-accent" : "border-brand-fg/20"
        }`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="mt-2 text-sm font-semibold text-brand-accent">
          {error}
        </p>
      )}
    </div>
  );
}
