// Plain console status lines — no TUI library, per the brief ("простой
// текстовый статус", not a full GUI). Timestamps are included on every line
// (the brief's own examples don't show one, but this console is the only
// diagnostic surface available if something goes wrong mid-event and you're
// reading it back over a call with the DJ — worth the extra few characters).
import type { AgentSong } from "./types";

function label(song: Pick<AgentSong, "artist_name" | "song_title">): string {
  return `${song.artist_name} - ${song.song_title}`;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

function line(text: string): void {
  console.log(`[${timestamp()}] ${text}`);
}

export const ui = {
  connected(): void {
    line("🔌 Подключено к Supabase, жду заявки...");
  },
  catchUp(count: number): void {
    line(
      count > 0
        ? `↺ При старте нашлось ${count} необработанных заявок — досматриваю...`
        : "↺ Необработанных заявок при старте не найдено."
    );
  },
  searching(song: AgentSong): void {
    line(`🔎 Скачиваю: ${label(song)}...`);
  },
  ready(song: AgentSong): void {
    line(`✅ Готово: ${label(song)}`);
  },
  needsReview(song: AgentSong, reason: string): void {
    line(`⚠️ Не найдено, отмечено для ручного поиска: ${label(song)} (${reason})`);
  },
  sourceError(song: AgentSong, sourceName: string, err: unknown): void {
    line(`❌ Источник "${sourceName}" упал для "${label(song)}": ${err instanceof Error ? err.message : String(err)}`);
  },
  realtimeStatus(status: string, err: Error | undefined): void {
    line(`📡 Realtime: ${status}${err ? ` (${err.message})` : ""}`);
  },
  fatal(message: string): void {
    line(`💥 ${message}`);
  },
};
