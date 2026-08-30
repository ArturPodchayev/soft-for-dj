import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig } from "./config";

// The anon key here is the same public key the browser uses — by itself it
// grants nothing extra. What actually gives this client the RLS-scoped
// row/column access from 0003_local_agent_rls.sql is signing in as the one
// dedicated agent user (README.md's setup section) below: the resulting
// session runs as Postgres role `authenticated`, which those policies (not
// `anon`) grant to.
export async function createSignedInAgentClient(config: AgentConfig): Promise<SupabaseClient> {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    // persistSession would try to use localStorage, which doesn't exist in
    // Node — autoRefreshToken still works fine without it (supabase-js just
    // keeps the session in memory and refreshes it on its own timer), which
    // is what a multi-hour event needs from a process that's never asked to
    // sign in twice.
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: config.agentEmail,
    password: config.agentPassword,
  });

  if (error) {
    throw new Error(
      `Не удалось войти в Supabase под агентом (${error.message}). Проверь agentEmail/agentPassword в config.json и что этот пользователь существует в Supabase Auth (см. README.md).`
    );
  }

  return supabase;
}
