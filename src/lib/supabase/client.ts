import { createClient } from "@supabase/supabase-js";

// Anon-key client for browser use — Realtime subscription on /display and
// the public insert on /submit. Row Level Security policies on
// song_requests restrict what this key can see and write (see
// supabase/migrations/0001_init.sql).
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
