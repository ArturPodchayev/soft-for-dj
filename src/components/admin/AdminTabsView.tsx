"use client";

import { useState } from "react";
import AdminHeader from "./AdminHeader";
import QueuePanel from "./QueuePanel";
import PendingFeed from "./PendingFeed";
import AllRequestsSection from "./AllRequestsSection";

type Tab = "queue" | "all";

// The queue/pending view (QueuePanel + PendingFeed) is exactly what
// AdminPage rendered before this component existed — grouped together
// under one tab so switching to "Все заявки" and back leaves that
// functionality untouched.
export default function AdminTabsView() {
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <>
      <AdminHeader />

      <nav className="flex gap-1 border-b border-brand-fg/10 px-6 pt-4">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
          Очередь
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          Все заявки
        </TabButton>
      </nav>

      {tab === "queue" ? (
        <>
          <QueuePanel />
          <PendingFeed />
        </>
      ) : (
        <AllRequestsSection />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
        active
          ? "border-brand-accent text-brand-fg"
          : "border-transparent text-brand-fg/50 hover:text-brand-fg/80"
      }`}
    >
      {children}
    </button>
  );
}
