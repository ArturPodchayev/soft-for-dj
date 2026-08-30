import type { Metadata } from "next";
import SubmitScreen from "@/components/submit/SubmitScreen";
import { VENUE } from "@/config/venue";

export const metadata: Metadata = {
  title: `${VENUE.copy.submitTitle} — ${VENUE.eventName}`,
};

export default function SubmitPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-bg px-4 py-12">
      <div className="w-full max-w-md">
        <SubmitScreen />
      </div>
    </main>
  );
}
