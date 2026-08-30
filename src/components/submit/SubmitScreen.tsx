"use client";

import { useState } from "react";
import { VENUE } from "@/config/venue";
import SubmitSongForm, { type SubmitOutcome } from "./SubmitSongForm";

// page.tsx is a Server Component (it needs the `metadata` export), but
// "hide the header once the form succeeds" needs to react to state that only
// exists client-side inside SubmitSongForm. This wrapper is the client
// boundary that owns that state instead: SubmitSongForm still tracks its own
// outcome for its own render (success/rejected cards), and just also reports
// it up here via onOutcomeChange so the header can react to the same value
// without a second, possibly-drifting copy of the state.
export default function SubmitScreen() {
  const [outcome, setOutcome] = useState<SubmitOutcome>(null);

  return (
    <>
      {/* Only "success" hides the header per the brief — "rejected" (the
          fake-number heuristic) and the pre-submit form both keep it. */}
      {outcome !== "success" && (
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-brand-fg">{VENUE.copy.submitTitle}</h1>
          <p className="mt-2 text-brand-fg/70">{VENUE.copy.submitSubtitle}</p>
        </div>
      )}
      <SubmitSongForm onOutcomeChange={setOutcome} />
    </>
  );
}
