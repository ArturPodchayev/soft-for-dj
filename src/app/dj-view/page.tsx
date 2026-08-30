import type { Metadata } from "next";
import DjView from "@/components/djview/DjView";
import { getDisplayQueue, type DisplayQueue } from "@/lib/displayQueue";
import { VENUE } from "@/config/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `DJ-вью — ${VENUE.eventName}`,
};

export default async function DjViewPage() {
  // Fetched server-side so the first paint already shows the real state —
  // same reasoning as /display's page.tsx.
  let initialData: DisplayQueue;
  try {
    initialData = await getDisplayQueue();
  } catch {
    initialData = { playing: null, next: null };
  }

  return <DjView initialData={initialData} />;
}
