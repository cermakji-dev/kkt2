import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Přihlášený uživatel, nebo null. getClaims() ověří podpis JWT lokálně
 * (bez dotazu na Supabase při asymetrických klíčích), takže je rychlé.
 * cache() zajistí jedno volání na request.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? '' };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error('Nepřihlášený uživatel');
  return user;
}
