import type { Metadata } from "next";
import SubmitSongForm from "@/components/submit/SubmitSongForm";
import { VENUE } from "@/config/venue";

export const metadata: Metadata = {
  title: `${VENUE.copy.submitTitle} — ${VENUE.eventName}`,
};

export default function SubmitPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-brand-fg">{VENUE.copy.submitTitle}</h1>
          <p className="mt-2 text-brand-fg/70">{VENUE.copy.submitSubtitle}</p>
        </div>
        <SubmitSongForm />
      </div>
    </main>
  );
}
