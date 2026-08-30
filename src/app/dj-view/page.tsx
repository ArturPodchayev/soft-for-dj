import type { Metadata } from "next";
import { cookies } from "next/headers";
import DjView from "@/components/djview/DjView";
import DjViewLogin from "@/components/djview/DjViewLogin";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/adminSession";
import { getDisplayQueue, type DisplayQueue } from "@/lib/displayQueue";
import { VENUE } from "@/config/venue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `DJ-вью — ${VENUE.eventName}`,
};

export default async function DjViewPage() {
  // Gated behind the same admin session as /admin (confirmed with the
  // user) — a "Переключить" button here calls the same protected
  // POST /api/admin/queue/next that /admin's queue panel does, so this
  // page needs the same session cookie for that call to succeed. NOT
  // routed through proxy.ts's matcher, deliberately: that would redirect
  // an unauthenticated visit to /admin/login, but the TZ's brief for this
  // screen is a single URL with no separate login route — checking the
  // cookie here and rendering the login form in place accomplishes the
  // same gate without a redirect hop.
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const authenticated = token ? await verifySessionToken(token) : false;

  if (!authenticated) {
    return <DjViewLogin />;
  }

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
