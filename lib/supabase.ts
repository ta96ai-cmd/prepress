// lib/supabase.ts
// Single authenticated browser client. For prepress schema, call
// supabase.schema('prepress').from(...) per query — this keeps the auth
// session attached (a separate db:{schema} client can drop the session,
// causing RLS to see no user).

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

// Main client — carries the auth session. Used for auth, public schema,
// AND prepress via .schema('prepress').
export const supabase = createBrowserClient(url, anon);

// Helper: prepress-scoped query builder that reuses the authenticated client.
export const pp = {
  from: (table: string) => supabase.schema("prepress").from(table),
  rpc: (fn: string, args?: Record<string, unknown>) =>
    supabase.schema("prepress").rpc(fn, args),
};