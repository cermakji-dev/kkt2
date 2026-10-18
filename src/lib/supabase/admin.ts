import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Klient se secret klíčem: jen na serveru, jen pro správu účtů. */
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
