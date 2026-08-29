import { NextRequest, NextResponse } from "next/server";
import { searchGeniusArtwork, GeniusNotConfiguredError } from "@/lib/genius";

// Backs the "Genius" artwork picker in the song detail modal
// (SongDetailModal.tsx). Under /api/admin/ so proxy.ts's matcher gates it
// behind the admin session — unauthenticated, this would be a free proxy
// to search Genius through our token for anyone who found the URL.
// Stateless: only searches, never touches the DB — the moderator applies a
// result by hand (which fills album_art_url, saved normally via the PATCH
// route) rather than this route writing anything itself.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const { query } = (body ?? {}) as { query?: string };
  const trimmedQuery = query?.trim() ?? "";
  if (!trimmedQuery) {
    return NextResponse.json({ message: "Нужен поисковый запрос" }, { status: 400 });
  }

  try {
    const candidates = await searchGeniusArtwork(trimmedQuery);
    if (candidates.length === 0) {
      return NextResponse.json({
        status: "not_found",
        message: "Genius ничего не нашёл по этому запросу — попробуйте другую формулировку.",
      });
    }
    return NextResponse.json({ status: "ok", candidates });
  } catch (err) {
    if (err instanceof GeniusNotConfiguredError) {
      return NextResponse.json({
        status: "unavailable",
        message: "Поиск через Genius ещё не настроен — добавьте GENIUS_ACCESS_TOKEN.",
      });
    }
    console.error("admin/genius-search: search failed", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({
      status: "error",
      message: "Поиск через Genius не удался, попробуйте ещё раз.",
    });
  }
}
