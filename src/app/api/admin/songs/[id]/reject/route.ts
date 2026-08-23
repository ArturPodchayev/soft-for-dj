import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("song_requests")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("status", "pending")
      .select();

    if (error) {
      console.error("Failed to reject song", error);
      return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Заявка больше не на модерации" }, { status: 409 });
    }

    return NextResponse.json({ song: data[0] });
  } catch (err) {
    console.error("api/admin/songs/[id]/reject: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
