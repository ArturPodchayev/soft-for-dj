import type { Metadata } from "next";
import AdminTabsView from "@/components/admin/AdminTabsView";
import { VENUE } from "@/config/venue";

export const metadata: Metadata = {
  title: `Админка — ${VENUE.eventName}`,
};

export default function AdminPage() {
  return <AdminTabsView />;
}
