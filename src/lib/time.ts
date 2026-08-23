// "Just now" / "5m ago" style relative timestamp for the admin panel's
// pending list, where an absolute timestamp is less useful at a glance than
// how long a request has been waiting.
export function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) return "только что";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
}
