import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { advanceQueue } from "@/lib/queueActions";

export async function POST() {
  try {
    const supabase = createServiceRoleClient();
    const result = await advanceQueue(supabase);

    switch (result.status) {
      case "error":
        console.error("Failed to advance queue", result.message);
        return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
      case "race":
        return NextResponse.json({ message: "Очередь изменилась, попробуйте ещё раз" }, { status: 409 });
      case "empty":
        return NextResponse.json({ playing: null });
      case "advanced":
        return NextResponse.json({ playing: result.playing });
    }
  } catch (err) {
    console.error("api/admin/queue/next: unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ message: "Что-то пошло не так" }, { status: 500 });
  }
}
