import type { DownloadStatus } from "@/lib/songs";

const LABELS: Partial<Record<DownloadStatus, string>> = {
  searching: "🟡 Ищем…",
  downloading: "🟡 Скачиваем…",
  ready: "🟢 Готово",
  needs_review: "🟠 Не уверены — проверь вручную",
  failed: "🔴 Не найдено — скачай вручную",
};

// Nothing rendered for 'not_started'/'pending'/'manual_required' — the
// approve route always writes 'searching' in the same update that sets
// status='approved' (see that route), so a still-unapproved or legacy row
// is the only way one of those shows up here, and neither is worth a badge.
export default function DownloadStatusBadge({
  status,
  reason,
}: {
  status: DownloadStatus;
  reason?: string | null;
}) {
  const label = LABELS[status];
  if (!label) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-brand-surface-fg/10 px-2.5 py-1 text-xs font-medium text-brand-surface-fg" title={reason ?? undefined}>
      {label}
    </span>
  );
}
