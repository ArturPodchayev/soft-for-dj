import type { Metadata } from "next";
import { headers } from "next/headers";
import DisplayScreen from "@/components/display/DisplayScreen";
import { getDisplayQueue, type DisplayQueue } from "@/lib/displayQueue";
import { VENUE } from "@/config/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${VENUE.eventName} — Now Playing`,
};

export default async function DisplayPage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const submitUrl = `${proto}://${host}/submit`;

  // Fetched server-side so the very first paint already shows the real
  // Now Playing / Next Up state — without this, the client would always
  // start from {playing: null, next: null} and briefly show the empty
  // placeholder until its Realtime subscription's first fetch resolves.
  let initialData: DisplayQueue;
  try {
    initialData = await getDisplayQueue();
  } catch {
    initialData = { playing: null, next: null };
  }

  return <DisplayScreen submitUrl={submitUrl} initialData={initialData} />;
}
