import type { SongStatus } from "@/lib/songs";

const STYLES: Record<SongStatus, string> = {
  pending: "bg-brand-surface-fg/10 text-brand-surface-fg",
  approved: "bg-brand-accent-2 text-brand-bg",
  playing: "bg-brand-surface-fg text-brand-surface ring-2 ring-brand-accent-2",
  played: "bg-brand-surface-fg/10 text-brand-surface-fg/50",
  rejected: "bg-brand-accent text-brand-bg",
};

const LABELS: Record<SongStatus, string> = {
  pending: "На модерации",
  approved: "Одобрено",
  playing: "Играет",
  played: "Сыграно",
  rejected: "Отклонено",
};

export default function StatusBadge({ status }: { status: SongStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
