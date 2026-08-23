import { createClient } from "@supabase/supabase-js";

// createClient() throws synchronously on a missing/malformed URL or key —
// fail with a clear message instead of an opaque "supabaseUrl is required".
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Anon-key client for server-side routes that should still be bound by RLS
// (the public /api/requests insert) — same permissions as a browser client,
// just called from the server so input can be validated/normalized and
// Postgres errors translated into friendly messages first.
export function createAnonServerClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );
}

// Service-role client for authenticated /api/admin/* routes. Bypasses RLS
// entirely, so it must only ever be used server-side, after the admin
// session cookie has been verified (see middleware.ts).
export function createServiceRoleClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}
