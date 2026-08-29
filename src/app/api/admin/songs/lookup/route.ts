import { NextRequest, NextResponse } from "next/server";
import { normalizeSongQuery } from "@/lib/deepseek";
import { searchItunesTrackInfo } from "@/lib/itunes";

// Backs "Найти заново" in the song detail modal — re-runs the same iTunes
// lookup the approve route already does automatically on first approval,
// for a moderator who wants to retry it later (e.g. after fixing a typo in
// artist/title). Stateless by design: only searches, never touches the DB —
// nothing is saved until the moderator hits "Сохранить" on the modal's
// (already-editable) duration/album art fields. Takes title+artist
// directly rather than a song id for that reason.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const { songTitle, artistName } = (body ?? {}) as { songTitle?: string; artistName?: string };
  const title = songTitle?.trim() ?? "";
  const artist = artistName?.trim() ?? "";

  if (!title || !artist) {
    return NextResponse.json({ message: "Нужны название песни и исполнитель" }, { status: 400 });
  }

  try {
    const normalizedQuery = await normalizeSongQuery(title, artist);
    const info = await searchItunesTrackInfo(normalizedQuery, artist, title);

    if (info.artworkUrl == null && info.durationSeconds == null) {
      return NextResponse.json({
        status: "not_found",
        message: "Ничего не найдено, заполните вручную.",
      });
    }

    return NextResponse.json({
      status: "ok",
      durationSeconds: info.durationSeconds,
      albumArtUrl: info.artworkUrl,
    });
  } catch (err) {
    console.error("admin/songs/lookup: search failed", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ status: "error", message: "Поиск не удался, попробуйте ещё раз." });
  }
}
