import { NextRequest, NextResponse } from "next/server";
import { createAnonServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { validateSubmitSong } from "@/lib/validation";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Некорректный запрос" }, { status: 400 });
  }

  const result = validateSubmitSong((body ?? {}) as Record<string, string>);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const { data, suspiciousPhone } = result;

  try {
    // A phone number that trips the fake-number heuristic is still
    // recorded — as 'rejected', never 'pending' — so the moderator can see
    // the attempt, but it never reaches the pending moderation feed or the
    // public queue. The client gets the same terminal "couldn't be
    // approved" response either way (see lib/validation.ts), so the
    // requester never learns their phone number specifically was the
    // problem.
    //
    // The public anon-key insert policy only allows status='pending' (see
    // supabase/migrations/0001_init.sql), so a suspicious submission goes
    // through the service-role client instead, which bypasses RLS. The
    // client never controls this choice — it's decided here from the
    // server-side heuristic, not from anything in the request body.
    const supabase = suspiciousPhone ? createServiceRoleClient() : createAnonServerClient();
    const { error } = await supabase.from("song_requests").insert({
      requester_name: data.requesterName,
      song_title: data.songTitle,
      artist_name: data.artistName,
      phone: data.phone,
      ...(suspiciousPhone ? { status: "rejected" as const } : {}),
    });

    if (error) {
      // Postgres unique_violation on song_requests_phone_unique.
      if (error.code === "23505") {
        return NextResponse.json({ message: "Вы уже отправили заявку." }, { status: 409 });
      }
      console.error("Failed to submit song request", error);
      return NextResponse.json({ message: "Что-то пошло не так, попробуйте ещё раз." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rejected: suspiciousPhone });
  } catch (err) {
    console.error("api/requests: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так, попробуйте ещё раз." }, { status: 500 });
  }
}
