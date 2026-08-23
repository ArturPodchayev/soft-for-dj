import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import QueuePanel from "@/components/admin/QueuePanel";
import PendingFeed from "@/components/admin/PendingFeed";
import { VENUE } from "@/config/venue";

export const metadata: Metadata = {
  title: `Админка — ${VENUE.eventName}`,
};

export default function AdminPage() {
  return (
    <>
      <AdminHeader />
      <QueuePanel />
      <PendingFeed />
    </>
  );
}
