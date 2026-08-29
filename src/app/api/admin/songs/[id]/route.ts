import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Backs the detail modal on the "Все заявки" table (SongDetailModal.tsx) —
// a moderator fixing a typo or manually overriding album art. Deliberately
// excludes status, download_status, and phone: status changes go through
// the existing approve/reject/advance routes (no second place to duplicate
// that logic), download_status is only ever written by the download
// pipeline, and phone is the anti-duplicate identifier, not something to
// hand-edit.
type PatchInput = {
  song_title?: string;
  artist_name?: string;
  requester_name?: string;
  duration_seconds?: number | null;
  youtube_url?: string | null;
  album_art_url?: string | null;
};

function isPlausibleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const input = (body ?? {}) as PatchInput;
  const update: Record<string, string | number | null> = {};
  const errors: Record<string, string> = {};

  if ("song_title" in input) {
    const value = input.song_title?.trim() ?? "";
    if (value.length < 1) errors.song_title = "Укажите название песни";
    else update.song_title = value;
  }
  if ("artist_name" in input) {
    const value = input.artist_name?.trim() ?? "";
    if (value.length < 1) errors.artist_name = "Укажите исполнителя";
    else update.artist_name = value;
  }
  if ("requester_name" in input) {
    const value = input.requester_name?.trim() ?? "";
    if (value.length < 2) errors.requester_name = "Укажите имя заказчика";
    else update.requester_name = value;
  }
  if ("duration_seconds" in input) {
    const value = input.duration_seconds;
    if (value === null) {
      update.duration_seconds = null;
    } else if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      update.duration_seconds = Math.round(value);
    } else {
      errors.duration_seconds = "Некорректная длительность";
    }
  }
  if ("youtube_url" in input) {
    const value = input.youtube_url?.trim() ?? "";
    if (value === "") update.youtube_url = null;
    else if (isPlausibleUrl(value)) update.youtube_url = value;
    else errors.youtube_url = "Некорректная ссылка";
  }
  if ("album_art_url" in input) {
    const value = input.album_art_url?.trim() ?? "";
    if (value === "") update.album_art_url = null;
    else if (isPlausibleUrl(value)) update.album_art_url = value;
    else errors.album_art_url = "Некорректная ссылка на картинку";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ message: "Нечего сохранять" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("song_requests").update(update).eq("id", id).select();

    if (error) {
      console.error("Failed to update song", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Заявка не найдена" }, { status: 404 });
    }

    return NextResponse.json({ song: data[0] });
  } catch (err) {
    console.error("admin/songs/[id] PATCH: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
