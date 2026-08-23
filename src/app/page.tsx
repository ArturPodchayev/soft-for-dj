import { VENUE } from "@/config/venue";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-bg px-4 text-center">
      <div>
        <h1 className="font-heading text-3xl font-bold text-brand-fg">{VENUE.eventName}</h1>
        <p className="mt-3 text-brand-fg/70">
          Маршруты: <code>/submit</code>, <code>/display</code>, <code>/admin</code>
        </p>
      </div>
    </main>
  );
}
